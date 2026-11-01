/** Strip only +reference-types metadata; retain every non-custom section byte. */
import { createHash } from 'node:crypto'
const sha = (b) => createHash('sha256').update(b).digest('hex')
function uint(bytes, cursor) {
  let value = 0
  for (let n = 0; n < 5; n++) {
    if (cursor.pos >= bytes.length) throw Error('Truncated u32 LEB')
    const b = bytes[cursor.pos++]
    if (n === 4 && b & 0xf0) throw Error('Overflow u32 LEB')
    value += (b & 127) * 2 ** (n * 7)
    if (!(b & 128)) return value
  }
  throw Error('Invalid u32 LEB')
}
function enc(value) {
  const out = []
  do {
    const b = value & 127
    value = Math.floor(value / 128)
    out.push(b | (value ? 128 : 0))
  } while (value)
  return Buffer.from(out)
}
function name(bytes, cursor) {
  const length = uint(bytes, cursor)
  if (length > bytes.length - cursor.pos) throw Error('Truncated WASM name')
  const start = cursor.pos
  cursor.pos += length
  return new TextDecoder('utf-8', { fatal: true }).decode(
    bytes.subarray(start, cursor.pos),
  )
}
export function sections(bytes) {
  bytes = Buffer.from(bytes)
  if (!bytes.subarray(0, 8).equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])))
    throw Error('Expected WASM 1 module')
  const out = [],
    cursor = { pos: 8 }
  while (cursor.pos < bytes.length) {
    const start = cursor.pos,
      id = bytes[cursor.pos++]
    if (id > 13) throw Error('Unexpected WASM section')
    const size = uint(bytes, cursor),
      body = cursor.pos
    if (size > bytes.length - body) throw Error('Truncated WASM section')
    cursor.pos += size
    out.push({
      id,
      bytes: bytes.subarray(start, cursor.pos),
      payload: bytes.subarray(body, cursor.pos),
    })
  }
  return out
}
export function numericInput(raw) {
  const parsed = sections(raw),
    output = [Buffer.from(raw).subarray(0, 8)]
  let removed = 0,
    featureSections = 0
  for (const section of parsed) {
    if (section.id !== 0) {
      output.push(section.bytes)
      continue
    }
    const cursor = { pos: 0 },
      bytes = section.payload
    if (name(bytes, cursor) !== 'target_features') {
      output.push(section.bytes)
      continue
    }
    featureSections++
    const prefix = bytes.subarray(0, cursor.pos),
      count = uint(bytes, cursor),
      entries = []
    const seen = new Set()
    for (let i = 0; i < count; i++) {
      const start = cursor.pos,
        sign = bytes[cursor.pos++]
      if (sign !== 43 && sign !== 45) throw Error('Invalid feature prefix')
      const feature = name(bytes, cursor)
      if (seen.has(feature)) throw Error('Duplicate target feature')
      seen.add(feature)
      if (feature === 'reference-types') {
        if (sign !== 43) throw Error('Expected enabled reference-types')
        removed++
      } else {
        if (feature === 'multivalue' && sign !== 43)
          throw Error('Multivalue disabled')
        entries.push(bytes.subarray(start, cursor.pos))
      }
    }
    if (!seen.has('multivalue') || cursor.pos !== bytes.length)
      throw Error('Feature metadata drift')
    const payload = Buffer.concat([prefix, enc(entries.length), ...entries])
    output.push(Buffer.from([0]), enc(payload.length), payload)
  }
  if (removed !== 1 || featureSections !== 1)
    throw Error('Expected one +reference-types entry')
  const bytes = Buffer.concat(output)
  const nonCustom = (list) =>
    list.filter((s) => s.id !== 0).map((s) => [s.id, sha(s.bytes)])
  const unchanged = nonCustom(parsed)
  if (JSON.stringify(unchanged) !== JSON.stringify(nonCustom(sections(bytes))))
    throw Error('Raw executable/data section changed')
  return {
    bytes,
    evidence: {
      rawSha256: sha(raw),
      numericSha256: sha(bytes),
      removed,
      nonCustomSections: unchanged,
    },
  }
}
