/** Read the final assembled numeric export ABI, never the pre-transform declaration. */
import { sections } from './wasm-portable-metadata.mjs'
export function portableTypes(bytes) {
  const ss = sections(bytes),
    types = [],
    functions = [],
    exports = [],
    imports = []
  const numeric = new Set([0x7f, 0x7d, 0x7c])
  function reader(b) {
    let at = 0
    const byte = () => {
      if (at >= b.length) throw Error('Truncated ABI')
      return b[at++]
    }
    const uint = () => {
      let v = 0
      for (let i = 0; i < 5; i++) {
        const x = byte()
        if (i === 4 && x & 240) throw Error('ABI overflow')
        v += (x & 127) * 2 ** (i * 7)
        if (!(x & 128)) return v
      }
      throw Error('ABI LEB overflow')
    }
    const name = () => {
      const n = uint()
      if (n > b.length - at) throw Error('ABI name overflow')
      const v = new TextDecoder('utf8', { fatal: true }).decode(
        b.subarray(at, at + n),
      )
      at += n
      return v
    }
    const done = () => {
      if (at !== b.length) throw Error('Unknown ABI section tail')
    }
    return { byte, uint, name, done }
  }
  for (const s of ss) {
    const r = reader(s.payload)
    if (s.id === 1) {
      for (let n = r.uint(); n--;) {
        if (r.byte() !== 0x60)
          throw Error('Only numeric function types supported')
        const signature = []
        for (let side = 0; side < 2; side++) {
          const list = []
          for (let count = r.uint(); count--;) {
            const t = r.byte()
            if (!numeric.has(t) && t !== 0x7e)
              throw Error('Reference/SIMD function ABI unsupported')
            list.push(t)
          }
          signature.push(list)
        }
        types.push(signature)
      }
      r.done()
    }
    if (s.id === 2) {
      for (let n = r.uint(); n--;) {
        const module = r.name(),
          name = r.name()
        if (r.byte() !== 0) throw Error('Imported storage unsupported')
        const type = r.uint()
        functions.push(type)
        imports.push({ module, name, type })
      }
      r.done()
    }
    if (s.id === 3) {
      for (let n = r.uint(); n--;) functions.push(r.uint())
      r.done()
    }
    if (s.id === 5) {
      if (r.uint() !== 1 || r.uint() !== 1)
        throw Error('Expected one unshared wasm32 bounded memory')
      const minimum = r.uint(),
        maximum = r.uint()
      if (minimum > 2048 || maximum !== 2048)
        throw Error('128MiB memory limit drift')
      r.done()
    }
    if (s.id === 7) {
      for (let n = r.uint(); n--;)
        exports.push({ name: r.name(), kind: r.byte(), index: r.uint() })
      r.done()
    }
  }
  const allowed = [
    'memory',
    'engine_info_json',
    'analyze_pcm_json',
    '__wbindgen_free',
    '__wbindgen_malloc',
    '__wbindgen_realloc',
    'asyncify_start_unwind',
    'asyncify_stop_unwind',
    'asyncify_start_rewind',
    'asyncify_stop_rewind',
    'asyncify_get_state',
    'fretbloom_asyncify_set_bounds',
  ].sort()
  if (
    JSON.stringify(exports.map((e) => e.name).sort()) !==
    JSON.stringify(allowed)
  )
    throw Error('Private export inventory drift')
  if (
    JSON.stringify(imports.map((i) => [i.module, i.name])) !==
    JSON.stringify([
      ['fretbloom_host', 'poll'],
      ['wbg', '__wbindgen_string_new'],
    ])
  )
    throw Error('Import inventory drift')
  const signatures = {}
  const lines = exports.map((e) => {
    if (e.kind === 2 && e.name === 'memory')
      return 'export const memory: WebAssembly.Memory;'
    if (e.kind !== 0) throw Error('Unexpected exported storage')
    const signature = types[functions[e.index]]
    if (!signature || signature.flat().some((t) => !numeric.has(t)))
      throw Error('Non-JS-number exported signature')
    signatures[e.name] = signature
    const [parameters, results] = signature,
      result =
        results.length === 0
          ? 'void'
          : results.length === 1
            ? 'number'
            : `[${results.map(() => 'number').join(', ')}]`
    return `export const ${e.name}: (${parameters.map((_, i) => `a${i}: number`).join(', ')}) => ${result};`
  })
  return {
    declaration:
      '/** Private final assembled ABI. Use the guarded facade. */\n' +
      lines.join('\n') +
      '\n',
    evidence: { imports, exports, signatures },
  }
}
