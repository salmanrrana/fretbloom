import { describe, it, expect } from 'vitest'
import { SincResampler } from './resampler'
function resample(input: Float32Array, rate: number, partition: number[]) {
  const r = new SincResampler(rate),
    out: Float32Array[] = []
  let p = 0,
    i = 0
  while (p < input.length) {
    const n = partition[i++ % partition.length]
    out.push(r.push(input.subarray(p, p + n)))
    p += n
  }
  out.push(r.finish())
  const joined = new Float32Array(out.reduce((n, x) => n + x.length, 0))
  let at = 0
  for (const x of out) {
    joined.set(x, at)
    at += x.length
  }
  return joined
}
function rms(data: Float32Array) {
  return Math.sqrt(
    data.subarray(200, -200).reduce((s, x) => s + x * x, 0) /
      (data.length - 400),
  )
}
describe('streaming windowed-sinc', () => {
  for (const rate of [8000, 16000, 24000, 32000, 44100, 48000, 96000])
    it(`preserves phase/count under arbitrary blocks at ${rate}`, () => {
      const wave = Float32Array.from(
        { length: rate },
        (_, i) =>
          0.3 * Math.sin((2 * Math.PI * 233 * i) / rate) +
          0.1 * Math.sin((2 * Math.PI * 1200 * i) / rate),
      )
      const a = resample(wave, rate, [rate]),
        b = resample(wave, rate, [17, 2031, 128, 1, 997])
      expect(a.length).toBe(24000)
      expect(b.length).toBe(a.length)
      expect(
        Math.max(...a.map((x, i) => Math.abs(x - b[i]))),
      ).toBeLessThanOrEqual(1e-6)
    })
  for (const rate of [32000, 44100, 48000, 96000])
    it(`rejects above-Nyquist aliases at ${rate}`, () => {
      const tone = (hz: number) =>
        Float32Array.from({ length: rate }, (_, i) =>
          Math.sin((2 * Math.PI * hz * i) / rate),
        )
      const pass = rms(resample(tone(1000), rate, [2048])),
        stop = rms(resample(tone(15000), rate, [2048]))
      expect(20 * Math.log10(stop / pass)).toBeLessThan(-40)
    })
  it('retains the impulse clock, rejects invalid rates and nonfinite samples', () => {
    const wave = new Float32Array(4800)
    wave[2400] = 1
    const out = resample(wave, 48000, [31, 120])
    expect(out.indexOf(Math.max(...out))).toBe(1200)
    for (const rate of [0, 7999, 96001, 44100.5])
      expect(() => new SincResampler(rate)).toThrow()
    expect(() =>
      new SincResampler(24000).push(new Float32Array([NaN])),
    ).toThrow()
  })
})
