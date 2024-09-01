//@ts-check
import * as cheerio from 'cheerio'
import fs from 'fs'
import os from 'os'
import pLimit from 'p-limit'
import path from 'path'
import PureImage from 'pureimage'
import FormData from 'form-data'
import { decodeJPEGFromStream } from './decodeJPEGfromStream.js'
import getSeed from './get-seed.js'
import HttpClient from './http-client.js'
import unscramble from './unscramble.js'
export default class Piccoma {
  constructor(options) {
    this.options = options
    this.client = new HttpClient(options)
    this.platform = os.platform()
  }

  async checkAuth() {
    await this.client.get('https://piccoma.com/web/acc/email/signin') // for csrf cookie
    const res = await this.client.get('https://piccoma.com/web/acc/top')
    const $ = await cheerio.load(res.data)
    return $('.PCM-loginMenu').length == 0
  }

  async login(email, password) {
    console.log('login...')
    const res = await this.client.get('https://piccoma.com/web/acc/email/signin')
    const $ = cheerio.load(res.data)
    const params = new URLSearchParams()
    const csrfToken = $('[name=csrfmiddlewaretoken]').val() ?? ''
    params.set('csrfmiddlewaretoken', String(csrfToken))
    params.set('next_url', '/web/')
    params.set('email', email)
    params.set('password', password)
    await this.client.post('https://piccoma.com/web/acc/email/signin', params)
  }

  async getBookmarks() {
    const res = await this.client.get('https://piccoma.com/web/bookshelf/list?type=B')
    const productIds = res.data.data.bookmark.map(book => book.id).join(',')
    const formData = new FormData()
    formData.append('products', productIds)
    const resProduct = await this.client.post('https://piccoma.com/web/bookshelf/product', formData)
    return resProduct.data.data.products.map(product => {
      return {
        id: product.id,
        url: `https://piccoma.com/web/product/${product.id}`,
        title: this._sanatizePath(product.title),
        webtoon: product.is_smartoon === 1,
      }
    })
  }

  async getEpisodes(id, webtoon) {
    const bookType = webtoon ? this.options.webtoon : this.options.manga
    const etype = bookType == 'chapter' ? 'E' : 'V'
    const url = `https://piccoma.com/web/product/${id}/episodes?etype=${etype}`
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
    if (bookType == 'chapter') {
      return this.getChapters($, id)
    } else {
      return this.getVolumes($, id)
    }
  }

  async getChapters($, id) {
    const $episodes = $('.PCM-epList li a')
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
        url: `https://piccoma.com/web/viewer/${id}/${$el.data('episode_id')}`,
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
          url: `https://piccoma.com/web/viewer/${id}/${$el.data('episode_id')}`,
          id: $el.data('episode_id'),
        })
        breakOut = true
      })
    }
    return episodes
  }

  async getVolumes($, id) {
    const $volumes = $('.PCM-volList li')
    const volumes = []
    $volumes.each((i, el) => {
      const $el = $(el)
      const freeButton = $el.find('.PCM-prdVol_freeBtn')
      const readButton = $el.find('.PCM-prdVol_readBtn')
      const name = $el.find('.PCM-prdVol_title h2').text()
      if (freeButton == null && readButton == null) {
        return
      }
      const episodeId = freeButton.length ? freeButton.attr('data-episode_id') : readButton.attr('data-episode_id')
      volumes.push({
        name: this._sanatizePath(String(name)),
        url: `https://piccoma.com/web/viewer/${id}/${episodeId}`,
        id: episodeId,
      })
    })
    return volumes
  }

  async saveEpisode(url, dist, progress) {
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
    const pdata = await this._getPdata($)
    if (pdata == null) {
      console.log('failed to get image list.')
      return
    }
    await this._saveEpisodeImages(pdata, dist, progress)
  }

  async saveEpisodeDirect(url, volumeRename) {
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
    const pdata = await this._getPdata($)
    if (pdata == null) {
      console.log('failed to get image list.')
      return
    }
    const title = this._getTitle($)
    const chapterTitle = this._sanatizePath(pdata.title)
    if (volumeRename == null) {
      volumeRename = title;
    }
    const dist = path.resolve(this.options.out, volumeRename, chapterTitle)
    await this._saveEpisodeImages(pdata, dist, (current, imgLen) => {
      process.stdout.write(`\r- ${volumeRename} ${chapterTitle} ${current}/${imgLen}`)
    })
  }

  _getTitle($) {
    return this._sanatizePath($('title').text().split('｜')[1])
  }

  async _getPdata($) {
    const index = Array.from($('script')).findIndex(el => $(el).html().includes('_pdata_ = '))
    const script = $($('script')[index]).html()
    if (script == '' || script == null) {
      return null
    }
    const pdataObj = script.split(`_pdata_ = `)[1].split(' var ')[0]
    return Function(`return ${pdataObj}`)()
  }

  async _saveEpisodeImages(pdata, dist, progress) {
    let cnt = 0
    await fs.promises.mkdir(dist, { recursive: true })
    const downloadLimit = pLimit(this.options.limit)
    const saveImagePromises = []
    const downloadPromises = []
    const imgList = this.options.type == 'jp' ? pdata.img : pdata.contents;
    for (let i = 0; i < imgList.length; i++) {
      const img = imgList[i]
      const url = img.path.includes('https') ? img.path : `https:${img.path}`
      const imagePath = path.resolve(dist, `${i + 1}.${this.options.format}`)
      if (fs.existsSync(imagePath)) {
        continue
      }
      downloadPromises.push(downloadLimit(async () => {
        const bitmap = await this._getBitmap(pdata, url)
        const promise = this._saveImage(bitmap, imagePath)
        saveImagePromises.push(promise)
        progress(++cnt, imgList.length)
      }))
    }
    await Promise.all(downloadPromises)
    await Promise.all(saveImagePromises)
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
        const image = await this._decodeStream(res, url)
        const bitmap = unscramble(pdata, image, 50, await getSeed(url))
        return bitmap
      } catch (error) {
        err = error
        await this._sleep(1000)
      }
    }
    throw err
  }

  _decodeStream(res, url) {
    if (res.headers['content-type'] == 'image/jpeg') {
      return decodeJPEGFromStream(res.data)
    } else if (res.headers['content-type'] == 'image/png') {
      return PureImage.decodePNGFromStream(res.data)
    }
    const ext = new URL(url).pathname.split('.').pop()
    if (ext == 'png') {
      return PureImage.decodePNGFromStream(res.data)
    }
    return decodeJPEGFromStream(res.data)
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