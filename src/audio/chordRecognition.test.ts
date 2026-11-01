import { expect, test } from 'vitest'
import { audibleFloor, chromaSimilarity, unitChroma } from './chordRecognition'
import type { SongFrame } from './songAnalysisTypes'

function frame(chroma: number[], rms: number): SongFrame {
  return { time: 0, chroma, rms, midi: null }
}

test('alignment ignores quiet frames and invalid energy before normalizing chroma', () => {
  const frames = [
    frame([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], 0.2),
    frame(
      Array.from({ length: 12 }, () => 1),
      0.002,
    ),
    frame([NaN, -1, Infinity, ...Array.from({ length: 9 }, () => 0)], 0.1),
    frame(
      Array.from({ length: 12 }, () => 1),
      NaN,
    ),
  ]
  const floor = audibleFloor(frames)
  expect(floor).toBeCloseTo(0.004)
  expect(audibleFloor([])).toBe(0.0015)
  const { unit, audible } = unitChroma(frames, floor)
  expect([...audible]).toEqual([1, 0, 0, 0])
  expect(chromaSimilarity(unit, 0, [0, 4, 7])).toBeCloseTo(1)
  expect(chromaSimilarity(unit, 0, [1, 5, 8])).toBe(0)
  expect([...unit.slice(12)]).toEqual(Array.from({ length: 36 }, () => 0))
})

test('alignment similarity distinguishes a triad from flat chroma or an empty target', () => {
  const { unit } = unitChroma(
    [
      frame(
        Array.from({ length: 12 }, () => 1),
        0.2,
      ),
    ],
    0.0015,
  )
  expect(chromaSimilarity(unit, 0, [0, 4, 7])).toBeCloseTo(0.5)
  expect(chromaSimilarity(unit, 0, [])).toBe(0)
})
