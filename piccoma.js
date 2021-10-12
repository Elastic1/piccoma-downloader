const cac = require('cac').default
const inquirer = require('inquirer')
const fs = require('fs')
const Piccoma = require('./lib/piccoma')
const cli = cac('piccoma-downloader')
cli.option('--config [path]', 'path for config file')
cli.option('--mail [mail]', 'Account mail')
cli.option('--password [password]', 'Account password')
cli.option('--all', 'Download all mangas in bookmarks')
cli.option('--manga [type]', 'chapter or volume')
cli.option('--webtoon [type]', 'chapter or volume')
cli.option('--timeout [ms]', 'timeout time in milliseconds(default: 60000ms)')
cli.option('--use-free', 'try to use one free ticket')
cli.option('--format', 'jpg or png (default: png)')
cli.option('--quality', 'jpg quality')
cli.help()
const cliOptions = cli.parse().options
if (cliOptions.help) {
  process.exit()
}

main()
async function main() {
  const options = await readOptions(cliOptions)
  const piccoma = new Piccoma(options)
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
      if (fs.existsSync(`manga/${book.title}/${episodeName}`)) {
        continue
      }
      const distDir = `manga/${book.title}/${episodeName}`
      const url = `https://piccoma.com/web/viewer/${book.id}/${episode.id}`
      await sleep(1000)
      for (let i = 0; i < 2; i++) {
        try {
          const startTime = Date.now()
          await piccoma.saveEpisode(url, distDir, (current, imgLen) => {
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
  console.log('end')
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
    quality: 85
  }
  if (cliOptions.config == null || cliOptions.config == '') {
    return Object.assign(defaultOptions, cliOptions)
  }
  const configStr = await fs.promises.readFile(cliOptions.config)
  const config = JSON.parse(configStr)
  return Object.assign(defaultOptions, cliOptions, config)
}