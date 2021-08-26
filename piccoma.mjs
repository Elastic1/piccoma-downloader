import cac from 'cac'
import puppeteer from 'puppeteer-extra'
import fs from 'fs'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import inquirer from 'inquirer'
import { login, getBookmarks, getVolumes, getEpisodes, saveVolume } from './lib/piccoma.mjs'
const cli = cac('piccoma-downloader')
cli.option('--mail [mail]', 'Account mail')
cli.option('--password [password]', 'Account password')
cli.option('--all', 'Download all mangas in bookmarks')
cli.help()
const options = cli.parse().options
if (options.help) {
  process.exit()
}
puppeteer.use(StealthPlugin())
const browser = await puppeteer.launch({ userDataDir: './data', headless: true })
const page = await browser.newPage()

const mail = options.mail
  ? options.mail
  : (await inquirer.prompt([
    {
      type: 'input',
      name: 'mail',
      message: 'Account mail:'
    }
  ])).mail
const password = options.password
  ? options.password
  : (await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: 'Account password:'
    }
  ])).password

console.log('login...');
await login(page, mail, password)
await page.waitForTimeout(1000)
await page.setViewport({
  width: 1080,
  height: 1920,
})
const bookmarks = await getBookmarks(page)
const books = options.all
  ? bookmarks
  : (await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'books',
      choices: bookmarks.map(book => ({
        checked: true,
        name: book.title,
        value: book
      }))
    }
  ])).books

for (const book of books) {
  const url = `https://piccoma.com/web/product/${book.id}/episodes?etype=${book.webtoon ? 'E' : 'V'}`
  process.stdout.write(`accessing ${book.title}...`)
  const title = book.title
  const volumes = book.webtoon ? await getEpisodes(page, url) : await getVolumes(page, url)
  if (volumes.length === 0) {
    process.stdout.write(`\n`)
    await page.waitForTimeout(1000)
    continue
  }
  console.log(`${volumes[0].name}～${volumes[volumes.length - 1].name}`)
  for (const vol of volumes) {
    const volName = vol.name.replace('プロローグ', '第0話');
    if (fs.existsSync(`manga/${title}/${volName}`) || fs.existsSync(`zip/${title}/${volName}.zip`)) {
      continue
    }
    const distDir = `manga/${title}/${volName}`
    const url = `https://piccoma.com/web/viewer/${book.id}/${vol.id}`
    await page.waitForTimeout(1000)
    for (let i = 0; i < 2; i++) {
      try {
        const startTime = Date.now()
        await saveVolume(page, url, distDir, (current, imgLen) => {
          process.stdout.write(`\r - ${volName} ${current}/${imgLen}`)
        })
        const endTime = Date.now()
        process.stdout.write(`. sent time ${Math.floor((endTime - startTime) / 1000)}s\n`)
        break
      } catch (error) {
        fs.rmSync(distDir, { force: true, recursive: true })
        console.log('error occurred. retry ', error)
      }
    }
  }
}
console.log('end.')