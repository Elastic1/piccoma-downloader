// @ts-check
function parseQs(query) {
  return query.split('&').reduce((obj, q) => {
    var keyval = q.split('=')
    obj[keyval[0]] = keyval[1]
    return obj
  }, {})
}

function getChecksum(path) {
  return path.split('/').slice(-2)[0]
}

function getSeedInternal(checksum, expires) {
  const total = expires.split('').reduce((total, num2) => total + parseInt(num2), 0)
  const ch = total % checksum.length
  return checksum.slice(ch * -1) + checksum.slice(0, ch * -1)
}

export default function getSeed(url) {
  const isFr = url.includes('fr.piccoma.com')
  const checksum = isFr ? parseQs(url).q : getChecksum(url)
  const expires = parseQs(url).expires
  const seed = getSeedInternal(checksum, expires)
  return seed
}
