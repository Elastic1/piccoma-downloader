//@ts-check
import JPEG from 'jpeg-js'
import { Bitmap } from 'pureimage/src/bitmap.js'

export function decodeJPEGFromStream(data) {
  return new Promise((res, rej) => {
    try {
      const chunks = []
      data.on('data', chunk => chunks.push(chunk))
      data.on('end', () => {
        const buf = Buffer.concat(chunks)
        let rawImageData = null
        try {
          rawImageData = JPEG.decode(buf, { maxMemoryUsageInMB: 1024 })
        } catch (err) {
          rej(err)
          return
        }
        const bitmap = new Bitmap(rawImageData.width, rawImageData.height, {})
        for (let x_axis = 0; x_axis < rawImageData.width; x_axis++) {
          for (let y_axis = 0; y_axis < rawImageData.height; y_axis++) {
            const n = (y_axis * rawImageData.width + x_axis) * 4
            bitmap.setPixelRGBA_i(x_axis, y_axis,
              rawImageData.data[n + 0],
              rawImageData.data[n + 1],
              rawImageData.data[n + 2],
              rawImageData.data[n + 3]
            )
          }
        }
        res(bitmap)
      })
      data.on("error", (err) => {
        rej(err)
      })
    } catch (e) {
      console.log(e)
      rej(e)
    }
  })
}