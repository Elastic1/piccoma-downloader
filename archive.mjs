import fs from 'fs'
import glob from 'glob'
import archiver from 'archiver'
import path from 'path'
glob('manga/*/*', async (err, files) => {
  let promises = []
  for (const src of files) {
    if (!fs.lstatSync(src).isDirectory()) {
      continue
    }
    promises.push(zip(src))
    if (promises.length === 15) {
      await Promise.all(promises)
      promises = []
    }
  }
  await Promise.all(promises)
})

function zip(src) {
  return new Promise(resolve => {
    const dist = src.replace('manga', 'zip') + '.zip'
    if (fs.existsSync(dist)) {
      resolve()
      return
    }
    console.log(`zip ${src}`)
    fs.mkdirSync(path.dirname(dist), { recursive: true })
    const output = fs.createWriteStream(dist)
    const archive = archiver('zip', { zlib: { level: 1 } })
    output.on('close', () => resolve())
    archive.pipe(output)
    archive.directory(src, false)
    archive.finalize()
  })
}
