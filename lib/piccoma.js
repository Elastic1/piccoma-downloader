//@ts-check
const cheerio = require('cheerio')
const fs = require('fs')
const PureImage = require('pureimage')
const path = require('path')
const HttpClient = require('./http-client')
const getSeed = require('./get-seed')
const unscramble = require('./unscramble')
const os = require('os')
module.exports = class PiccomaPage {
  constructor(options) {
    this.options = options
    this.client = new HttpClient(options)
    this.platform = os.platform()
  }

  async checkAuth() {
    const res = await this.client.get('https://piccoma.com/web/acc/top')
    const $ = await cheerio.load(res.data)
    return $('.PCM-loginMenu').length == 0
  }

  async login(email, password) {
    console.log('login...')
    const res = await this.client.get('https://piccoma.com/web/acc/email/signin')
    const $ = cheerio.load(res.data)
    const params = new URLSearchParams()
    params.set('csrfmiddlewaretoken', $('[name=csrfmiddlewaretoken]').val().toString())
    params.set('next_url', '/web/')
    params.set('email', email)
    params.set('password', password)
    await this.client.post('https://piccoma.com/web/acc/email/signin', params)
  }

  async getBookmarks() {
    const res = await this.client.get('https://piccoma.com/web/bookshelf/bookmark')
    const $ = await cheerio.load(res.data)
    const books = []
    $('.PCM-product').each((i, el) => {
      const $el = $(el)
      books.push({
        id: $el.attr('href').split('/').pop(),
        url: $el.attr('href'),
        title: this._sanatizePath($el.find('.PCM-productCoverImage_title').text()),
        webtoon: $el.parent().hasClass('PCM-stt_smartoon')
      })
    })
    return books
  }

  async getEpisodes(id, webtoon) {
    const bookType = webtoon ? this.options.webtoon : this.options.manga
    const etype = bookType == 'chapter' ? 'E' : 'V'
    const url = `https://piccoma.com/web/product/${id}/episodes?etype=${etype}`
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
    if (bookType == 'chapter') {
      return this.getChapters($)
    } else {
      return this.getVolumes($)
    }
  }

  async getChapters($) {
    const $episodes = $('.PCM-product_episodeList a')
    const episodes = []
    $episodes.each((i, el) => {
      const $el = $(el)
      const freeEl = $el.find('.PCM-epList_status_webwaitfree img').length
      const pointEl = $el.find('.PCM-epList_status_point .js_point').length
      const zeroPlusEl = $el.find('.PCM-epList_status_zeroPlus img').length
      if (freeEl || pointEl || zeroPlusEl) {
        return
      }
      episodes.push({
        name: this._sanatizePath($el.find('.PCM-epList_title h2').text()),
        id: $el.data('episode_id'),
      })
    })
    if (this.options.useFree) {
      let breakOut = false
      $episodes.each((i, el) => {
        const $el = $(el)
        if (breakOut || $el.parent().hasClass('PCM-epList_read') || !$el.find('.PCM-epList_status_webwaitfree img').length) {
          return
        }
        episodes.push({
          name: this._sanatizePath($el.find('.PCM-epList_title h2').text()),
          id: $el.data('episode_id'),
        })
        breakOut = true
      })
    }
    return episodes
  }

  async getVolumes($) {
    const $volumes = $('.PCM-prdVol')
    const volumes = []
    $volumes.each((i, el) => {
      const $el = $(el)
      const freeButton = $el.find('.PCM-prdVol_freeBtn')
      const readButton = $el.find('.PCM-prdVol_readBtn')
      const name = $el.find('.PCM-prdVol_title h2').text()
      if (freeButton == null && readButton == null) {
        return
      }
      volumes.push({
        name: this._sanatizePath(String(name)),
        id: freeButton.length ? freeButton.attr('data-episode_id') : readButton.attr('data-episode_id'),
      })
    })
    return volumes
  }

  async saveEpisode(url, dist, progress) {
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
    const pdata = this._getPdata($)
    if (pdata == null) {
      console.log('failed to get image list.')
      return
    }
    await this._saveEpisodeImages(pdata, dist, progress)
  }

  async saveEpisodeDirect(url) {
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
    const pdata = this._getPdata($)
    if (pdata == null) {
      console.log('failed to get image list.')
      return
    }
    const title = this._getTitle($, url)
    const chapterTitle = this._sanatizePath(pdata.title)
    const dist = path.resolve(this.options.out, title, chapterTitle)
    await this._saveEpisodeImages(pdata, dist, (current, imgLen) => {
      process.stdout.write(`\r- ${title} ${chapterTitle} ${current}/${imgLen}`)
    })
  }

  _getTitle($, url) {
    if (url.includes('fr.piccoma.com')) {
      const index = Array.from($('script')).findIndex(el => $(el).html().includes('product_title = '))
      const script = $($('script')[index]).html()
      if (script == '' || script == null) {
        return null
      }
      const projectTitleObj = script.split(`product_title = `)[1].split(' const ')[0]
      return this._sanatizePath(Function(`return ${projectTitleObj}`)())
    }
    return this._sanatizePath($('title').text().split('｜')[1])
  }

  _getPdata($) {
    const index = Array.from($('script')).findIndex(el => $(el).html().includes('_pdata_ = '))
    const script = $($('script')[index]).html()
    if (script == '' || script == null) {
      return null
    }
    const pdataObj = script.split(`_pdata_ = `)[1].split(' var ')[0]
    return Function(`return ${pdataObj}`)()
  }

  async _saveEpisodeImages(pdata, dist, progress) {
    await fs.promises.mkdir(dist, { recursive: true })
    const promises = []
    for (let i = 0; i < pdata.img.length; i++) {
      const img = pdata.img[i]
      const url = img.path.includes('https') ? img.path : 'https:'
      const imagePath = path.resolve(dist, `${i + 1}.${this.options.format}`)
      if (fs.existsSync(imagePath)) {
        continue
      }
      const bitmap = await this._getBitmap(pdata, url)
      const promise = this._saveImage(bitmap, imagePath)
      promises.push(promise)
      progress(i + 1, pdata.img.length)
    }
    await Promise.all(promises)
  }

  _saveImage(bitmap, path) {
    if (this.options.format == 'jpg') {
      return PureImage.encodeJPEGToStream(bitmap, fs.createWriteStream(path), this.options.quality ?? 85)
    } else {
      return PureImage.encodePNGToStream(bitmap, fs.createWriteStream(path))
    }
  }

  async _getBitmap(pdata, url) {
    let err = null
    for (let i = 0; i < 3; i++) {
      try {
        const res = await this.client.request(url, { method: 'GET', responseType: 'stream' })
        const image = await PureImage.decodeJPEGFromStream(res.data)
        const bitmap = unscramble(pdata, image, 50, getSeed(url))
        return bitmap
      } catch (error) {
        if (error?.message?.includes('SOI')) {
          return this._getBitmapPNG(pdata, url)
        }
        err = error
        await this._sleep(1000)
      }
    }
    throw err
  }

  async _getBitmapPNG(pdata, url) {
    let err = null
    for (let i = 0; i < 3; i++) {
      try {
        const res = await this.client.request(url, { method: 'GET', responseType: 'stream' })
        const image = await PureImage.decodePNGFromStream(res.data)
        const bitmap = unscramble(pdata, image, 50, getSeed(url))
        return bitmap
      } catch (error) {
        err = error
        await this._sleep(1000)
      }
    }
    throw err
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  _sanatizePath(path) {
    if (this.platform.indexOf('win') === 0) {
      path = path.replace(/[\\/:*?"<>|\r\n\t]/g, '')
    }
    if (this.platform.indexOf('linux') === 0) {
      path = path.replace(/[/\r\n\t]/g, '')
    }
    if (this.platform.indexOf('darwin') === 0) {
      path = path.replace(/[/:\r\n\t]/g, '')
    }
    return path.replace(/[.\s]+$/g, '').trim()
  }
}