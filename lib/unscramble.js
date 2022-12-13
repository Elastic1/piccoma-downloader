//@ts-check
import unscramble from './unscrambleImg.js'
import PureImage from 'pureimage'

export default function (pdata, image, num, seed) {
  const bitmap = PureImage.make(image.width, image.height, {})
  const ctx = bitmap.getContext("2d")
  bitmap.width = image.width
  bitmap.height = image.height
  if (!pdata.isScrambled) {
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, image.width, image.height)
    return bitmap
  }
  unscramble(image, num, seed, ctx)
  return bitmap
}