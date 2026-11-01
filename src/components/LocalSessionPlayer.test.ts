import { expect, it } from 'vitest'
import { pcmToWav } from './LocalSessionPlayer'
it('quantizes canonical little-endian float audio into a mono 24 kHz PCM16 WAV', async () => {
  const input = new ArrayBuffer(5 * 4)
  const values = new DataView(input)
  ;[-2, -0.5, 0, 0.5, 2].forEach((value, i) =>
    values.setFloat32(i * 4, value, true),
  )
  const wav = new DataView(
    await (await pcmToWav(new Blob([input]))).arrayBuffer(),
  )
  expect(wav.getUint32(24, true)).toBe(24000)
  expect(wav.getUint16(22, true)).toBe(1)
  expect(
    Array.from({ length: 5 }, (_, i) => wav.getInt16(44 + i * 2, true)),
  ).toEqual([-32768, -16384, 0, 16384, 32767])
})
it('rejects nonfinite audio and malformed byte lengths instead of exporting them', async () => {
  await expect(pcmToWav(new Blob([new Float32Array([NaN])]))).rejects.toThrow(
    'invalid samples',
  )
  await expect(pcmToWav(new Blob([new Uint8Array(3)]))).rejects.toThrow('size')
})
it('accounts the WAV buffer and immutable Blob overlap at construction', async () => {
  const counts: number[] = []
  const wav = await pcmToWav(new Blob([new Float32Array(65536)]), (bytes) =>
    counts.push(bytes),
  )
  expect(counts.at(-1)).toBe(wav.size * 2)
  expect(Math.max(...counts)).toBeGreaterThanOrEqual(wav.size * 2)
})
