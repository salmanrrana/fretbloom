import type { SongAnalysis, SyncTarget } from '../songAnalysisTypes'
import compact from './ccr-rain.json'

/** [time, midi, rms, ...chroma in thousandths] per frame. */
type CompactFrame = [number, number | null, number, ...number[]]

/**
 * Features the analyzer extracted from CCR "Have You Ever Seen The Rain"
 * (YouTube bO28lB1uwp4, 165 s): a real full-band mix with vocals. Stored
 * compactly (chroma in thousandths) and without any audio.
 */
export function ccrRainAnalysis(): SongAnalysis {
  return {
    duration: compact.duration,
    hopSeconds: compact.hopSeconds,
    frames: (compact.frames as CompactFrame[]).map(
      ([time, midi, rms, ...chroma]) => ({
        time,
        midi,
        rms,
        chroma: chroma.map((value) => value / 1000),
      }),
    ),
    notes: [],
    chords: [],
  }
}

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const
const SHEET_CHORDS = {
  C: [PC.C, PC.E, PC.G],
  F: [PC.F, PC.A, PC.C],
  G: [PC.G, PC.B, PC.D],
  Am: [PC.A, PC.C, PC.E],
  'F/C': [PC.F, PC.A, PC.C],
  'C/B': [PC.B, PC.C, PC.E, PC.G],
  'Am7/G': [PC.G, PC.A, PC.C, PC.E],
} satisfies Record<string, number[]>

type SheetChord = keyof typeof SHEET_CHORDS

const VERSE: SheetChord[] = ['C', 'C', 'G', 'C', 'C', 'C', 'G', 'C']
const CHORUS_HALF: SheetChord[] = ['F', 'G', 'C', 'C/B', 'Am', 'Am7/G']
const CHORUS: SheetChord[] = [...CHORUS_HALF, ...CHORUS_HALF, 'F', 'G', 'C']

/** The pasted sheet's 68 chord steps in order. */
export const CCR_RAIN_SHEET: SheetChord[] = [
  'Am',
  'F/C',
  'C',
  'G',
  'C',
  ...VERSE,
  ...CHORUS,
  ...VERSE,
  ...CHORUS,
  ...CHORUS,
  'G',
  'C',
]

/** The sheet as chord targets, the way the tab parser hands them to alignSong. */
export function ccrRainTargets(): SyncTarget[] {
  return CCR_RAIN_SHEET.map((chord) => ({
    kind: 'chord',
    midis: SHEET_CHORDS[chord].map((pc) => 60 + pc),
  }))
}

export interface ReferenceRun {
  label: string
  /** Index of the run's first sheet step. */
  firstTarget: number
  /** Seconds where the fixture's chroma flips to this chord. */
  start: number
  /** Allowed error in seconds; see the notes on the wider ones. */
  tolerance: number
}

/**
 * Hand-verified chord timeline: the sheet's 68 steps collapse to 60 runs of
 * distinct pitch-class sets. Starts come from the per-second ground truth
 * refined to where the chroma actually flips (the song sits on a 1.03 s
 * two-beat grid, roughly 0.3 s after each integer second). Slash-bass
 * boundaries (C -> C/B -> Am -> Am7/G) are softer, so they get 0.9 s.
 *
 * Two runs deviate from the sheet in the recording itself: the intro G is
 * played G (7.2 s), then a bass walk on E to 8.4 s that reads as C/E, then G
 * again; the final G (151.9 s) has the vocal holding E over it until 153.3 s.
 * The aligner hears those G's from their second, unambiguous stretch, so
 * they get 1.5 s.
 */
export const CCR_RAIN_RUNS: ReferenceRun[] = (() => {
  const starts: [string, number, number?][] = [
    ['Am', 0.3],
    ['F', 2.73],
    ['C', 4.52],
    ['G', 7.17, 1.5],
    ['C', 8.88],
    ['G', 21.25],
    ['C', 25.26],
    ['G', 38.14],
    ['C', 41.9],
    ['F', 46.08],
    ['G', 48.21],
    ['C', 50.26],
    ['C/B', 51.28],
    ['Am', 52.4],
    ['Am7/G', 53.33],
    ['F', 54.44],
    ['G', 56.23],
    ['C', 58.11],
    ['C/B', 59.56],
    ['Am', 60.67],
    ['Am7/G', 61.78],
    ['F', 62.72],
    ['G', 64.85],
    ['C', 66.73],
    ['G', 79.36],
    ['C', 82.86],
    ['G', 95.74],
    ['C', 99.84],
    ['F', 104.02],
    ['G', 106.07],
    ['C', 107.78],
    ['C/B', 109.14],
    ['Am', 110.25],
    ['Am7/G', 111.19],
    ['F', 112.3],
    ['G', 114.35],
    ['C', 116.39],
    ['C/B', 117.5],
    ['Am', 118.53],
    ['Am7/G', 119.55],
    ['F', 120.66],
    ['G', 122.71],
    ['C', 124.59],
    ['F', 128.85],
    ['G', 130.9],
    ['C', 132.95],
    ['C/B', 134.06],
    ['Am', 135.08],
    ['Am7/G', 136.11],
    ['F', 137.22],
    ['G', 139.26],
    ['C', 141.14],
    ['C/B', 142.34],
    ['Am', 143.44],
    ['Am7/G', 144.38],
    ['F', 145.58],
    ['G', 147.63],
    ['C', 148.74],
    ['G', 151.89, 1.5],
    ['C', 153.77],
  ]
  const firstTargets: number[] = []
  CCR_RAIN_SHEET.forEach((chord, index) => {
    const previous = CCR_RAIN_SHEET[index - 1]
    if (
      index === 0 ||
      SHEET_CHORDS[chord].join() !== SHEET_CHORDS[previous].join()
    )
      firstTargets.push(index)
  })
  return starts.map(([label, start, tolerance], index) => {
    const slashBoundary =
      label.includes('/') || starts[index - 1]?.[0].includes('/')
    return {
      label,
      firstTarget: firstTargets[index],
      start,
      tolerance: tolerance ?? (slashBoundary ? 0.9 : 0.6),
    }
  })
})()
