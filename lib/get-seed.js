// @ts-check
import dd from './dd.js'

function getChecksum(path) {
  return path.split('/').slice(-2)[0]
}

function getSeedInternal(checksum, expires) {
  const total = expires.split('').reduce((total, num2) => total + parseInt(num2), 0)
  const ch = total % checksum.length
  return checksum.slice(ch * -1) + checksum.slice(0, ch * -1)
}

export default async function getSeed(url) {
  const isFr = /cdn\.fr\.piccoma\.com/.test(url);
  const checksum = isFr ? new URL(url).searchParams.get('q') : getChecksum(url)
  const expires = new URL(url).searchParams.get('expires')
  const seed = getSeedInternal(checksum, expires)
  return await dd(seed)
}