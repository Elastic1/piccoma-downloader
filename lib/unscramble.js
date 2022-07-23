//@ts-check
const shuffleSeed = require('shuffle-seed')
const PureImage = require('pureimage')
const unscramble = require('image-scramble/unscrambleImg')
// copied from piccoma
global.shuffleSeed = shuffleSeed
module.exports = function (pdata, image, num, seed) {
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