const magic = 'AGFzbQEAAAABBgFgAn9/AAMCAQAFAwEAEQcPAgZtZW1vcnkCAAJkZAAACk0BSwECfwNAIAEgAkcEQEEBIAJ0QcfFxQFxRSACQRVLckUEQCAAIAJqIgMgAy0AACIDIANBAXRBAnFrQQFqOgAACyACQQFqIQIMAQsLCwA7CXByb2R1Y2VycwEMcHJvY2Vzc2VkLWJ5AgZ3YWxydXMGMC4yMC4zDHdhc20tYmluZGdlbgYwLjIuODk='

let wasm;

async function init() {
  if (wasm != null) {
    return;
  }
  const buf = Buffer.from(magic, 'base64')
  const res = await WebAssembly.instantiate(buf, {})
  wasm = res.instance.exports
}

export default async function dd(seed) {
  await init();
  const enc = new TextEncoder("utf-8");
  const bytes = new Uint8Array(wasm.memory.buffer, 0, seed.length);
  bytes.set(enc.encode(seed));
  wasm.dd(bytes.byteOffset, bytes.length)
  const dec = new TextDecoder("utf-8");
  return dec.decode(bytes);
}