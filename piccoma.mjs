import cac from 'cac'
import puppeteer from 'puppeteer-extra'
import fs from 'fs'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import inquirer from 'inquirer'
import Piccoma from './lib/piccoma.mjs'
const cli = cac('piccoma-downloader')
cli.option('--config [path]', 'path for config file')
cli.option('--mail [mail]', 'Account mail')
cli.option('--password [password]', 'Account password')
cli.option('--all', 'Download all mangas in bookmarks')
cli.option('--manga [type]', 'chapter or volume')
cli.option('--webtoon [type]', 'chapter or volume')
cli.option('--timeout [ms]', 'timeout time in milliseconds(default: 30000ms)')
cli.option('--use-free', 'try to use one free ticket')
cli.option('--format', 'jpg or png (default: png)')
cli.option('--quality', 'jpg quality')
cli.help()
const _options = cli.parse().options
if (_options.help) {
  process.exit()
}
const config = await readConfig(_options.config)
const options = Object.assign({
  webtoon: 'chapter',
  manga: 'volume',
  timeout: 30000,
  format: 'png',
  quality: 85
}, _options, config)
puppeteer.use(StealthPlugin())
const browser = await puppeteer.launch({ userDataDir: './data', headless: true })
const page = await browser.newPage()
await page.setDefaultNavigationTimeout(options.timeout)
const mail = options.mail || options.sessionid
  ? options.mail
  : (await inquirer.prompt([
    {
      type: 'input',
      name: 'mail',
      message: 'Account mail:'
    }
  ])).mail
const password = options.password || options.sessionid
  ? options.password
  : (await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: 'Account password:'
    }
  ])).password

const piccoma = new Piccoma(page)
if (options.sessionid) {
  await page.setCookie({
    name: 'sessionid',
    value: options.sessionid,
    domain: 'piccoma.com',
    path: '/',
    httpOnly: true,
    secure: true,
    session: false,
    sameParty: false,
    sourceScheme: 'Secure',
    sourcePort: 443
  })
  await page.goto('https://piccoma.com/web/')
} else {
  console.log('login...')
  await piccoma.login(mail, password)
}
await page.waitForTimeout(1000)
await page.setViewport({
  width: 1080,
  height: 1920,
})
const bookmarks = await piccoma.getBookmarks()
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
  const bookType = book.webtoon ? options.webtoon : options.manga
  const url = `https://piccoma.com/web/product/${book.id}/episodes?etype=${bookType == 'chapter' ? 'E' : 'V'}`
  process.stdout.write(`accessing ${book.title}...`)
  const title = book.title
  const volumes = bookType == 'chapter'
    ? await piccoma.getEpisodes(url, options.useFree)
    : await piccoma.getVolumes(url)
  if (volumes.length === 0) {
    process.stdout.write(`\n`)
    await page.waitForTimeout(1000)
    continue
  }
  console.log(`${volumes[0].name}～${volumes[volumes.length - 1].name}`)
  for (const vol of volumes) {
    const volName = vol.name.replace('プロローグ', '第0話')
    if (fs.existsSync(`manga/${title}/${volName}`) || fs.existsSync(`zip/${title}/${volName}.zip`)) {
      continue
    }
    const distDir = `manga/${title}/${volName}`
    const url = `https://piccoma.com/web/viewer/${book.id}/${vol.id}`
    await page.waitForTimeout(1000)
    for (let i = 0; i < 2; i++) {
      try {
        const startTime = Date.now()
        await piccoma.saveVolume(url, distDir, options, (current, imgLen) => {
          process.stdout.write(`\r - ${volName} ${current}/${imgLen}`)
        })
        const endTime = Date.now()
        process.stdout.write(`. spent time ${Math.floor((endTime - startTime) / 1000)}s\n`)
        break
      } catch (error) {
        fs.rmSync(distDir, { force: true, recursive: true })
        console.log('error occurred. retry ', error)
      }
    }
  }
}
console.log('end.')
process.exit()

async function readConfig(path) {
  if (path == null || path == '') {
    return {}
  }
  const configStr = await fs.promises.readFile(path)
  const config = JSON.parse(configStr)
  return config
}