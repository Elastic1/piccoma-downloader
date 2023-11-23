import fs from 'fs/promises'
const store = { lib: null }

async function dd(seed) {
  if (store.lib == null) {
    const source = await fs.readFile('diamond.wasm')
    const wasm = await WebAssembly.compile(source)
    store.lib = await instantiate(wasm);
  }
  return store.lib.dd(seed)
}

async function instantiate(module, imports = {}) {
  const adaptedImports = {
    env: Object.assign(Object.create(globalThis), imports.env || {}, {
      abort(message, fileName, lineNumber, columnNumber) {
        // ~lib/builtins/abort(~lib/string/String | null?, ~lib/string/String | null?, u32?, u32?) => void
        message = __liftString(message >>> 0)
        fileName = __liftString(fileName >>> 0)
        lineNumber = lineNumber >>> 0
        columnNumber = columnNumber >>> 0
        ;(() => {
          // @external.js
          throw Error(`${message} in ${fileName}:${lineNumber}:${columnNumber}`)
        })()
      },
    }),
  }
  const { exports } = await WebAssembly.instantiate(module, adaptedImports)
  const memory = exports.memory || imports.env.memory
  const adaptedExports = Object.setPrototypeOf(
    {
      de(s) {
        // assembly/index/de(~lib/string/String) => ~lib/string/String
        s = __lowerString(s) || __notnull()
        return __liftString(exports.de(s) >>> 0)
      },
      dd(s) {
        // assembly/index/dd(~lib/string/String) => ~lib/string/String
        s = __lowerString(s) || __notnull()
        return __liftString(exports.dd(s) >>> 0)
      },
    },
    exports,
  )
  function __liftString(pointer) {
    if (!pointer) return null
    const end = (pointer + new Uint32Array(memory.buffer)[(pointer - 4) >>> 2]) >>> 1,
      memoryU16 = new Uint16Array(memory.buffer)
    let start = pointer >>> 1,
      string = ''
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)))
    return string + String.fromCharCode(...memoryU16.subarray(start, end))
  }
  function __lowerString(value) {
    if (value == null) return 0
    const length = value.length,
      pointer = exports.__new(length << 1, 2) >>> 0,
      memoryU16 = new Uint16Array(memory.buffer)
    for (let i = 0; i < length; ++i) memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i)
    return pointer
  }
  function __notnull() {
    throw TypeError('value must not be null')
  }
  return adaptedExports
}

export default dd;