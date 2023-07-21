import cac from 'cac'
import fs from 'fs'
import inquirer from 'inquirer'
import path from 'path'
import Piccoma from './lib/piccoma.js'
import PiccomaFr from './lib/piccoma-fr.js'
const cli = cac('piccoma-downloader')
cli.option('--type [type]', 'jp or fr (default: jp)')
cli.option('--config [path]', 'path for config file')
cli.option('--mail [mail]', 'Account mail')
cli.option('--password [password]', 'Account password')
cli.option('--all', 'Download all mangas in bookmarks')
cli.option('--manga [type]', 'chapter or volume (default: volume)')
cli.option('--webtoon [type]', 'chapter or volume (default: chapter)')
cli.option('--timeout [ms]', 'timeout time in milliseconds(default: 60000ms)')
cli.option('--use-free', 'try to use one free ticket')
cli.option('--format [format]', 'jpg or png (default: png)')
cli.option('--quality [quality]', 'jpg quality (default: 85)')
cli.option('--out [path]', 'output directory (default: manga)')
cli.option('--chapter-url [url]', 'Download chapter url (support multiple url)')
cli.option('--volume-rename', 'Rename volume')
cli.option('--limit [limit]', 'max concurrency limit (default: 2)')
cli.help()
const cliOptions = cli.parse().options
if (cliOptions.help) {
  process.exit()
}

main().finally(() => {
  console.log('end')
})
async function main() {
  const options = await readOptions(cliOptions)
  options.type = await askType(options)
  const piccoma = options.type == 'fr' ? new PiccomaFr(options) : new Piccoma(options)
  if (options.chapterUrl) {
    if (options.type == 'jp' && options.sessionid && await piccoma.checkAuth()) {
      console.log('use sessionid')
    } else if (options.mail && options.password) {
      await piccoma.login(options.mail, options.password)
    }
    const chapterUrls = [].concat(options.chapterUrl);
    for (let y = 0; y < chapterUrls.length; y++) {
      for (let i = 0; i < 2; i++) {
        try {
          const startTime = Date.now()
          await piccoma.saveEpisodeDirect(chapterUrls[y], options.volumeRename)
          const endTime = Date.now()
          process.stdout.write(`. spent time ${Math.floor((endTime - startTime) / 1000)}s\n`)
          break
        } catch (error) {
          console.log('error occurred. retry ', error.message)
        }
      }
    }
    return
  }
  if (options.sessionid && await piccoma.checkAuth()) {
    console.log('use sessionid')
  } else {
    const mail = await askMail(options)
    const password = await askPassword(options)
    await piccoma.login(mail, password)
  }
  await sleep(1000)
  const bookmarks = await piccoma.getBookmarks()
  const books = await selectBooks(options, bookmarks)
  for (const book of books) {
    process.stdout.write(`accessing ${book.title}...`)
    const episodes = await piccoma.getEpisodes(book.id, book.webtoon)
    if (episodes.length === 0) {
      process.stdout.write(`\n`)
      await sleep(1000)
      continue
    }
    console.log(`${episodes[0].name}～${episodes[episodes.length - 1].name}`)
    for (const episode of episodes) {
      const episodeName = episode.name
      const title = options.volumeRename == null ? book.title : options.volumeRename;
      const distDir = path.resolve(options.out, title, episodeName)
      if (fs.existsSync(distDir)) {
        continue
      }
      await sleep(1000)
      for (let i = 0; i < 2; i++) {
        try {
          const startTime = Date.now()
          await piccoma.saveEpisode(episode.url, distDir, (current, imgLen) => {
            process.stdout.write(`\r - ${episodeName} ${current}/${imgLen}`)
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
}

async function askType(options) {
  if (options.type) {
    return options.type
  }
  const prompt = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Piccoma type:',
      choices: [
        'jp',
        'fr'
      ]
    }
  ])
  return prompt.type
}

async function askPassword(options) {
  if (options.password || options.sessionid) {
    return options.password
  }
  const prompt = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: 'Account password:'
    }
  ])
  return prompt.password
}

async function askMail(options) {
  if (options.mail) {
    return options.mail
  }
  const prompt = await inquirer.prompt([
    {
      type: 'input',
      name: 'mail',
      message: 'Account mail:'
    }
  ])
  return prompt.mail
}

async function selectBooks(options, bookmarks) {
  if (options.all) {
    return bookmarks
  }
  const prompt = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'books',
      choices: bookmarks.map(book => ({
        checked: true,
        name: book.title,
        value: book
      }))
    }
  ])
  return prompt.books
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function readOptions(cliOptions) {
  const defaultOptions = {
    webtoon: 'chapter',
    manga: 'volume',
    timeout: 60000,
    format: 'png',
    quality: 85,
    out: 'manga',
    limit: 2,
  }
  if (cliOptions.config == null || cliOptions.config == '') {
    return Object.assign(defaultOptions, cliOptions)
  }
  const configStr = await fs.promises.readFile(cliOptions.config)
  const config = JSON.parse(configStr)
  return Object.assign(defaultOptions, cliOptions, config)
}
