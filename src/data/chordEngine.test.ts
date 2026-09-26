import { describe, expect, test } from 'vitest'

import { resolveChord } from './chordEngine'

const frets = (symbol: string) => resolveChord(symbol)?.shape.frets

describe('resolveChord', () => {
  test('slash chords put the written bass on the lowest sounding string', () => {
    expect(frets('C/E')).toEqual([0, 3, 2, 0, 1, 0])
    expect(frets('C/G')).toEqual([3, 3, 2, 0, 1, 0])
    expect(frets('C/B')).toEqual([-1, 2, 2, 0, 1, 0])
    expect(frets('G/B')).toEqual([-1, 2, 0, 0, 0, 3])
    expect(frets('Am7/G')).toEqual([3, 0, 2, 0, 1, 0])
    expect(frets('F/C')).toEqual([-1, 3, 3, 2, 1, 1])
    // An open string beats a stretch (and loses its finger); generated barre
    // shapes work too.
    expect(resolveChord('Bm/A')?.shape).toMatchObject({
      frets: [-1, 0, 4, 4, 3, 2],
      fingers: [0, 0, 3, 4, 2, 1],
    })
    expect(frets('D/A')).toEqual([-1, 0, 0, 2, 3, 2])
    expect(frets('Bb/D')).toEqual([-1, -1, 0, 3, 3, 1])
    expect(resolveChord('C/B')?.approx).toBe(false)
    // A bass no low string can reach under the hand is flagged, not dropped.
    expect(resolveChord('Ebsus4/G')?.approx).toBe(true)
  })

  test('roots that land on fret 0 give open chords, not 12th-fret barres', () => {
    expect(resolveChord('Emaj7')?.shape).toMatchObject({
      frets: [0, 2, 1, 1, 0, 0],
      fingers: [0, 3, 1, 2, 0, 0],
      baseFret: 1,
    })
    expect(resolveChord('F#m')?.shape).toMatchObject({
      frets: [2, 4, 4, 2, 2, 2],
      baseFret: 2,
    })
  })

  test('flags substituted qualities, but never curated spellings', () => {
    expect(resolveChord('C9')?.approx).toBe(true)
    expect(resolveChord('Cadd9')?.approx).toBe(false)
    expect(resolveChord('Amazing')).toBeNull()
  })
})
