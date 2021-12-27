//@ts-check
const cheerio = require('cheerio')
const fs = require('fs')
const PureImage = require('pureimage')
const path = require('path')
const HttpClient = require('./http-client')
const getSeed = require('./get-seed')
const unscramble = require('./unscramble')

module.exports = class PiccomaPage {
  constructor(options) {
    this.options = options
    this.client = new HttpClient(options)
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
        title: $el.find('.PCM-productCoverImage_title').text(),
        webtoon: $el.parent().hasClass('PCM-stt_smartoon')
      })
    })
    return books
  }

  async getEpisodes(id, webtoon) {
    const bookType = webtoon ? this.options.webtoon : this.options.manga
    const etype = bookType == 'chapter' ? 'E' : 'V'
    const url = `https://piccoma.com/web/product/${id}/episodes?etype=${etype}`
    if (bookType == 'chapter') {
      return this.getChapters(url)
    } else {
      return this.getVolumes(url)
    }
  }

  async getChapters(url) {
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
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
        name: $el.find('.PCM-epList_title h2').text(),
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
          name: $el.find('.PCM-epList_title h2').text(),
          id: $el.data('episode_id'),
        })
        breakOut = true
      })
    }
    return episodes
  }

  async getVolumes(url) {
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
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
        name: String(name),
        id: freeButton.length ? freeButton.attr('data-episode_id') : readButton.attr('data-episode_id'),
      })
    })
    return volumes
  }

  async saveEpisode(url, dist, progress) {
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
    const index = Array.from($('script')).findIndex(el => $(el).html().includes('_pdata_ = '))
    const script = $($('script')[index]).html()
    if (script == '' || script == null) {
      console.log('May not have been purchased. ' + dist)
      return
    }
    const pdataObj = script.split(`_pdata_ = `)[1].split(' var ')[0]
    const pdata = Function(`return ${pdataObj}`)()
    if (pdata == null) {
      console.log('failed to get image list.')
      return
    }
    await fs.promises.mkdir(dist, { recursive: true })
    const promises = []
    for (let i = 0; i < pdata.img.length; i++) {
      const img = pdata.img[i]
      const url = 'https:' + img.path
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
        err = error
        await this._sleep(1000)
      }
    }
    throw err;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}