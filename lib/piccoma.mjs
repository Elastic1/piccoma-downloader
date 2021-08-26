import canvas from 'canvas'
import fs from 'fs'
import imagemin from 'imagemin'
import imageminPngquant from 'imagemin-pngquant'
import get from 'simple-get'
import getSeed from './get-seed.mjs'
import unscramble from './unscramble.mjs'
const { Image } = canvas
export async function login(page, mail, password) {
  page.goto('https://piccoma.com/web/acc/email/signin?next_url=/web/')
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  await page.type('[name=email]', mail, { delay: 50 })
  await page.type('[name=password]', password, { delay: 50 })
  await page.click('.PCM-submitButton input[type=submit]', { delay: 500 })
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
}

/**
 * @param {import('puppeteer').Page} page 
 */
export async function getBookmarks(page) {
  page.goto('https://piccoma.com/web/bookshelf/bookmark')
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('.PCM-product')).map(a => ({
      id: a.href.split('/').pop(),
      url: a.href,
      title: a.querySelector('.PCM-productCoverImage_title').textContent,
      webtoon: a.parentElement.classList.contains('PCM-stt_smartoon')
    }))
  })
}

export async function getEpisodes(page, url) {
  page.goto(url)
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  return page.evaluate(() => {
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

export async function getVolumes(page, url) {
  page.goto(url)
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  return page.evaluate(() => {
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
          name,
          id: freeButton ? freeButton.dataset.episode_id : readButton.dataset.episode_id,
        }
      })
  })
}

export async function saveVolume(page, url, dist, progress) {
  page.goto(url)
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  const pdata = await page.evaluate(() => {
    return window._pdata_
  });
  if (pdata == null) {
    console.log('May not have been purchased. ' + dist)
    return;
  }
  fs.mkdirSync(dist, { recursive: true })
  for (let i = 0; i < pdata.img.length - 1; i++) {
    const img = pdata.img[i]
    const url = 'https:' + img.path
    if (fs.existsSync(`${dist}/${i + 1}.png`)) {
      continue
    }
    await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        const canvas = unscramble(pdata, image, 50, getSeed(url))
        imagemin.buffer(canvas.toBuffer(), {
          plugins: [imageminPngquant()]
        }).then(buffer => {
          fs.writeFile(`${dist}/${i + 1}.png`, buffer, () => {})
        })
        progress(i + 1, pdata.img.length - 1)
        resolve()
      };
      image.onerror = e => {
        console.log(`${i + 1}.png failed`)
        resolve(e)
      }
      loadImage(url, image)
    })
  }
}

function loadImage(url, image, retry = true) {
  get.concat({ url, timeout: 5000 }, (err, res, data) => {
    if (err) {
      if (retry) {
        loadImage(url, image, false)
      }
    } else {
      image.src = data
    }
  })
}
