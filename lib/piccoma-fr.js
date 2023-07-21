//@ts-check
import * as cheerio from 'cheerio'
import path from 'path'
import Piccoma from './piccoma.js'
export default class PiccomaFr extends Piccoma {
  async login(email, password) {
    console.log('login...')
    const params = new URLSearchParams()
    params.set('redirect', '/fr/')
    params.set('email', email)
    params.set('password', password)
    await this.client.post('https://piccoma.com/fr/api/auth/signin', params)
  }

  async getBookmarks() {
    const url = `https://piccoma.com/fr/api/haribo/fr/bookshelf/v2/bookmark`
    const res = await this.client.get(url)
    return res.data.data.products.map(pr => {
      return {
        id: pr.id,
        url: `https://piccoma.com/fr/product/episode/${pr.id}`,
        title: this._sanatizePath(pr.title),
        webtoon: pr.type == 'A'
      }
    })
  }

  async getEpisodes(id) {
    const url = `https://piccoma.com/fr/product/episode/${id}`
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
    const __NEXT_DATA__ = this._getNextData($)
    const { category_id, first_episode_id, first_volume_id } = __NEXT_DATA__.props.pageProps.initialState.productHome.productHome.product
    const bookType = category_id == 2 ? this.options.webtoon : this.options.manga
    if ((bookType == 'volume' || first_episode_id == null) && first_volume_id != null) {
      return this.getVolumes(id)
    }
    const episodes = __NEXT_DATA__.props.pageProps.initialState.episode.episodeList.episode_list
    return episodes
      .filter(ep => ['FR01', 'RD01', 'AB01'].includes(ep.use_type))
      .map(ep => ({
        id: ep.id,
        url: `https://piccoma.com/fr/viewer/${id}/${ep.id}`,
        name: this._sanatizePath(ep.title)
      }))
  }

  async getVolumes(id) {
    const url = `https://piccoma.com/fr/product/volume/${id}`
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
    const __NEXT_DATA__ = this._getNextData($)
    const episodes = __NEXT_DATA__.props.pageProps.initialState.episode.episodeList.episode_list
    return episodes
      .filter(ep => ['FR01', 'RD01', 'AB01'].includes(ep.use_type))
      .map(ep => ({
        id: ep.id,
        url: `https://piccoma.com/fr/viewer/${id}/${ep.id}`,
        name: this._sanatizePath(ep.title)
      }))
  }

  async saveEpisode(url, dist, progress) {
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
    const pdata = await this._getPdata($, url)
    if (pdata == null) {
      console.log('failed to get image list.')
      return
    }
    await this._saveEpisodeImages(pdata, dist, progress)
  }

  async saveEpisodeDirect(url, volumeRename) {
    const res = await this.client.get(url)
    const $ = await cheerio.load(res.data)
    const pdata = await this._getPdata($, url)
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
    const __NEXT_DATA__ = this._getNextData($)
    return __NEXT_DATA__.props.pageProps.initialState.productHome.productHome.product.title
  }

  async _getPdata($, chapterURL) {
    const __NEXT_DATA__ = this._getNextData($)
    const params = new URL(chapterURL).pathname.split('/')
    const episodeId = params[4]
    const productId = params[3]
    const url = `https://piccoma.com/fr/_next/data/${__NEXT_DATA__.buildId}/fr/viewer/${productId}/${episodeId}.json`
    const res = await this.client.get(url)
    return res.data.pageProps.initialState.viewer.pData
  }

  _getNextData($) {
    return JSON.parse($('#__NEXT_DATA__').text())
  }
}
