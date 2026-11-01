import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  phrase,
  renderPcm,
  f32le,
  wav16,
  partitions,
  differences,
} from './fixtures.mjs'

test('renderer has independent pitch truth, silence, bounded gain and exact f32 encoding', () => {
  const spec = phrase()
  const pcm = renderPcm(spec)
  assert.equal(pcm.length, 192000)
  assert.ok(pcm.slice(0, 6000).every((v) => v === 0))
  assert.ok(pcm.every((v) => Number.isFinite(v) && Math.abs(v) < 1))
  // A3=220 Hz: independently count positive crossings in a steady 1-second interval.
  let crossings = 0
  for (let i = 12001; i < 36000; i++)
    if (pcm[i - 1] <= 0 && pcm[i] > 0) crossings++
  assert.ok(Math.abs(crossings - 220) <= 1)
  const bytes = f32le(pcm)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < pcm.length; i++)
    assert.equal(view.getFloat32(i * 4, true), pcm[i])
  assert.equal(wav16(pcm).length, 44 + pcm.length * 2)
})
test('random chunks cover odd and long inputs without loss', () => {
  for (const n of [1, 127, 2049, 44101, 7200000]) {
    const sizes = partitions(n)
    assert.equal(
      sizes.reduce((sum, v) => sum + v, 0),
      n,
    )
    assert.ok(sizes.every((v) => v > 0 && v <= 4097))
  }
})
test('parity comparator never tolerates changed MIDI, boundaries, alternatives or streams', () => {
  assert.equal(differences({ cents: 1 }, { cents: 1.000001 }).length, 0)
  for (const key of ['midi', 'start', 'end', 'rootPc', 'bassPc'])
    assert.equal(differences({ [key]: 1 }, { [key]: 1.000001 }).length, 1)
  assert.equal(
    differences({ alternatives: [] }, { alternatives: [{}] }).length,
    1,
  )
  assert.equal(
    differences({ monophonicNotes: [57] }, { polyphonicNotes: [57] }).length,
    2,
  )
})
