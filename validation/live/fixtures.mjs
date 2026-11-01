// Development controls only. Labels describe the renderer, never engine output.
export const RATE = 24000
export function phrase(seconds = 8, concertAHz = 440) {
  const events = []
  for (let start = 0.25; start < seconds - 0.2; start += 4) {
    events.push({
      start,
      end: Math.min(start + 1.65, seconds),
      midis: [57],
      kind: 'sine',
    })
    events.push({
      start: start + 2,
      end: Math.min(start + 3.65, seconds),
      midis: [48, 52, 55, 60],
      kind: 'pluck',
    })
  }
  return { seconds, concertAHz, events: events.filter((e) => e.start < e.end) }
}
export function renderPcm(spec, rate = RATE) {
  const pcm = new Float32Array(Math.floor(spec.seconds * rate))
  for (const event of spec.events) {
    for (const [voice, midi] of event.midis.entries()) {
      const start = event.start + (event.kind === 'pluck' ? voice * 0.012 : 0)
      const hz = spec.concertAHz * 2 ** ((midi - 69) / 12)
      for (
        let i = Math.ceil(start * rate);
        i < Math.min(pcm.length, Math.floor(event.end * rate));
        i++
      ) {
        const t = i / rate - start
        const envelope = Math.min(1, t / 0.008, (event.end - i / rate) / 0.025)
        let value = Math.sin(2 * Math.PI * hz * t)
        if (event.kind === 'pluck') {
          value = 0
          for (
            let harmonic = 1;
            harmonic <= 6 && hz * harmonic < rate / 2;
            harmonic++
          )
            value += Math.sin(2 * Math.PI * hz * harmonic * t) / harmonic ** 1.7
          value *= Math.exp(-t / 1.5)
        }
        pcm[i] += (value * envelope * 0.16) / Math.sqrt(event.midis.length)
      }
    }
  }
  return pcm
}
export function f32le(pcm) {
  const bytes = new Uint8Array(pcm.length * 4)
  const view = new DataView(bytes.buffer)
  pcm.forEach((sample, i) => view.setFloat32(i * 4, sample, true))
  return bytes
}
export function wav16(pcm, rate = RATE) {
  const bytes = new Uint8Array(44 + pcm.length * 2)
  const view = new DataView(bytes.buffer)
  for (const [offset, text] of [
    [0, 'RIFF'],
    [8, 'WAVEfmt '],
    [36, 'data'],
  ])
    [...text].forEach((char, i) =>
      view.setUint8(offset + i, char.charCodeAt(0)),
    )
  view.setUint32(4, bytes.length - 8, true)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  view.setUint32(40, pcm.length * 2, true)
  pcm.forEach((sample, i) =>
    view.setInt16(
      44 + i * 2,
      Math.round(Math.max(-1, Math.min(1, sample)) * 32767),
      true,
    ),
  )
  return bytes
}
export function partitions(length, seed = 0x51ab) {
  const sizes = []
  while (length > 0) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const size = Math.min(length, 1 + (seed % 4097))
    sizes.push(size)
    length -= size
  }
  return sizes
}
// Exact structural comparison; tolerance applies only to floating evidence/cents.
export function differences(a, b, path = '$') {
  if (typeof a === 'number' && typeof b === 'number') {
    const approximate =
      /\.(score|margin|cents|estimatedOffsetCents|rms)$/.test(path) ||
      /\.chroma\[\d+\]$/.test(path)
    return Math.abs(a - b) <= (approximate ? 1e-5 : 0)
      ? []
      : [{ path, native: a, wasm: b }]
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length)
      return [{ path: `${path}.length`, native: a.length, wasm: b.length }]
    return a.flatMap((value, i) => differences(value, b[i], `${path}[${i}]`))
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object'
  ) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
    return keys.flatMap((key) => differences(a[key], b[key], `${path}.${key}`))
  }
  return a === b ? [] : [{ path, native: a, wasm: b }]
}
