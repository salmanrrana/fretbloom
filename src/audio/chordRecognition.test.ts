import { describe, expect, test } from 'vitest'
import { recognizeChords } from './chordRecognition'
import { CCR_RAIN_RUNS, ccrRainAnalysis } from './fixtures/ccrRain'
import type { SongFrame } from './songAnalysisTypes'

const HOP = 0.1

function frame(time: number, pitchClasses: number[], rms = 0.2): SongFrame {
  const chroma = Array.from({ length: 12 }, () => 0.02)
  for (const pc of pitchClasses) chroma[pc] += 1
  return { time, chroma, midi: null, rms }
}

/** A note and its overtone: the second pitch class at a third of the weight. */
function frameOf(time: number, [root, overtone]: number[]): SongFrame {
  const chroma = Array.from({ length: 12 }, () => 0.02)
  chroma[root] += 1
  chroma[overtone] += 0.33
  return { time, chroma, midi: null, rms: 0.2 }
}

function stretch(
  start: number,
  count: number,
  pitchClasses: number[],
  rms = 0.2,
): SongFrame[] {
  return Array.from({ length: count }, (_, index) =>
    frame(start + index * HOP, pitchClasses, rms),
  )
}

describe('recognizeChords', () => {
  test('labels held triads, marks silence, and ignores a one-frame blip', () => {
    const frames = [
      ...stretch(0, 5, [], 0),
      ...stretch(0.5, 8, [0, 4, 7]),
      frame(1.3, [9, 0, 4]),
      ...stretch(1.4, 6, [0, 4, 7]),
      ...stretch(2, 6, [7, 11, 2]),
      ...stretch(2.6, 6, [9, 0, 4]),
    ]

    const chords = recognizeChords(frames, HOP, 3.2)

    expect(chords.map((chord) => chord.label)).toEqual(['N', 'C', 'G', 'Am'])
    expect(chords.map((chord) => chord.start)).toEqual([0, 0.5, 2, 2.6])
    expect(chords.at(-1)?.end).toBe(3.2)
    expect(chords[0].confidence).toBe(0)
    expect(chords[1].confidence).toBeGreaterThan(0.9)
  })

  test('reads a lone melody as no chord', () => {
    // One pitch class per frame with its fifth as an overtone, the way a
    // plucked single note looks to the analyzer, each with a detected MIDI.
    const melody = [64, 67, 69, 71].flatMap((midi, index) =>
      Array.from({ length: 10 }, (_, frame) => ({
        ...frameOf(0.5 + index + frame * HOP, [midi % 12, (midi + 7) % 12]),
        midi,
      })),
    )
    const chords = recognizeChords(
      [...stretch(0, 5, [], 0), ...melody],
      HOP,
      4.5,
    )

    expect(chords.map((chord) => chord.label)).toEqual(['N'])
  })

  test('finds the chord changes of the real CCR recording', () => {
    const analysis = ccrRainAnalysis()
    const chords = recognizeChords(
      analysis.frames,
      analysis.hopSeconds,
      analysis.duration,
    )

    // Every real change must be a recognized change, within tolerance.
    const missed = CCR_RAIN_RUNS.slice(1).filter(
      (run) =>
        !chords.some(
          (chord) => Math.abs(chord.start - run.start) <= run.tolerance,
        ),
    )
    expect(missed).toEqual([])

    // Plain triads should carry their own label. Slash chords legitimately
    // resolve to a neighbour, and a vocal holding E over G can read as Em,
    // which is why this is a ratio and not every run.
    const plain = CCR_RAIN_RUNS.filter((run) => !run.label.includes('/'))
    const labelled = plain.filter((run) =>
      chords.some(
        (chord) =>
          chord.label === run.label &&
          Math.abs(chord.start - run.start) <= run.tolerance,
      ),
    )
    expect(labelled.length / plain.length).toBeGreaterThanOrEqual(0.85)
    expect(chords.at(-1)?.label).toBe('N')
  })
})
