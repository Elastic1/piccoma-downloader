import canvas from 'canvas'
import fs from 'fs'
import get from 'simple-get'
import getSeed from './get-seed.mjs'
import unscramble from './unscramble.mjs'
const { Image } = canvas
export default class PiccomaPage {
  constructor(page) {
    /** @type {import('puppeteer-core').Page} */
    this.page = page
  }

  async login(mail, password) {
    this.page.goto('https://piccoma.com/web/acc/email/signin?next_url=/web/')
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    await this.page.type('[name=email]', mail, { delay: 50 })
    await this.page.type('[name=password]', password, { delay: 50 })
    await this.page.click('.PCM-submitButton input[type=submit]', { delay: 500 })
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  }

  async getBookmarks() {
    this.page.goto('https://piccoma.com/web/bookshelf/bookmark')
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    return this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.PCM-product')).map(a => ({
        id: a.href.split('/').pop(),
        url: a.href,
        title: a.querySelector('.PCM-productCoverImage_title').textContent,
        webtoon: a.parentElement.classList.contains('PCM-stt_smartoon')
      }))
    })
  }

  async getEpisodes(url) {
    this.page.goto(url)
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    return this.page.evaluate(() => {
      const episodes = document.querySelectorAll('.PCM-product_episodeList a')
      return Array.from(episodes)
        .map(ep => {
          return {
            name: ep.querySelector('.PCM-epList_title h2').textContent,
            id: ep.dataset.episode_id,
          }
        })
    })
  }

  async getVolumes(url) {
    this.page.goto(url)
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    return this.page.evaluate(() => {
      const volumes = document.querySelectorAll('.PCM-prdVol')
      return Array.from(volumes)
        .map(vol => [
          vol.querySelector('.PCM-prdVol_freeBtn'),
          vol.querySelector('.PCM-prdVol_readBtn'),
          vol.querySelector('.PCM-prdVol_title h2').textContent
        ])
        .filter(([freeButton, readButton]) => freeButton || readButton)
        .map(([freeButton, readButton, name]) => {
          return {
            name: String(name),
            id: freeButton ? freeButton.dataset.episode_id : readButton.dataset.episode_id,
          }
        })
    })
  }

  async saveVolume(url, dist, progress) {
    this.page.goto(url)
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    const pdata = await this.page.evaluate(() => {
      return window._pdata_
    })
    if (pdata == null) {
      console.log('May not have been purchased. ' + dist)
      return
    }
    fs.mkdirSync(dist, { recursive: true })
    for (let i = 0; i < pdata.img.length - 1; i++) {
      const img = pdata.img[i]
      const url = 'https:' + img.path
      if (fs.existsSync(`${dist}/${i + 1}.png`)) {
        continue
      }
      const buffer = await this._saveUrlImage(pdata, url)
      await fs.promises.writeFile(`${dist}/${i + 1}.png`, buffer)
      progress(i + 1,　pdata.img.length - 1)
    }
  }

  async _saveUrlImage(pdata, url) {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = async () => {
        const canvas = unscramble(pdata, image, 50, getSeed(url))
        const buffer = canvas.toBuffer()
        resolve(buffer)
      }
      image.onerror = e => {
        reject(e)
      }
      this._loadImage(url, image)
    })
  }

  _loadImage(url, image, retry = true) {
    get.concat({ url, timeout: 5000 }, (err, res, data) => {
      if (err) {
        if (retry) {
          this._loadImage(url, image, false)
        }
      } else {
        image.src = data
      }
    })
  }
}