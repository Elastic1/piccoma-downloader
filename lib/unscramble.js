//@ts-check
import unscramble from 'image-scramble/unscrambleImg.js'
import PureImage from 'pureimage'
import shuffleSeed from 'shuffle-seed'
// copied from piccoma
global.shuffleSeed = shuffleSeed
export default function (pdata, image, num, seed) {
  var a = PureImage.make(image.width, image.height, {})
    , s = a.getContext("2d");
  a.width = image.width,
    a.height = image.height;
  if (!pdata.isScrambled) {
    s.drawImage(image, 0, 0, image.width, image.height, 0, 0, image.width, image.height);
    return a;
  }
  unscramble(image, num, seed, { ctx: s })
  return a;
}