import type { ChordShape } from './chords'
import { CHORDS } from './chords'

/**
 * Turns arbitrary chord symbols ("F#m7", "Bb", "Cmaj7", "D/F#") into playable
 * shapes. Open-position shapes come from the dictionary; everything else is
 * generated from movable E-shape and A-shape barre templates.
 */

const PITCH_CLASS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
}

type Quality = 'maj' | 'min' | '7' | 'm7' | 'maj7' | 'sus2' | 'sus4' | '5'

interface Template {
  offsets: number[]
  fingers: number[]
}

// Offsets are relative to the barre fret; -1 = muted. Low E → high e.
const E_SHAPES: Partial<Record<Quality, Template>> = {
  maj:  { offsets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
  min:  { offsets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
  '7':  { offsets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1] },
  m7:   { offsets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1] },
  maj7: { offsets: [0, 2, 1, 1, 0, 0], fingers: [1, 4, 2, 3, 1, 1] },
  sus4: { offsets: [0, 2, 2, 2, 0, 0], fingers: [1, 2, 3, 4, 1, 1] },
  '5':  { offsets: [0, 2, 2, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0] },
}

const A_SHAPES: Partial<Record<Quality, Template>> = {
  maj:  { offsets: [-1, 0, 2, 2, 2, 0], fingers: [0, 1, 2, 3, 4, 1] },
  min:  { offsets: [-1, 0, 2, 2, 1, 0], fingers: [0, 1, 3, 4, 2, 1] },
  '7':  { offsets: [-1, 0, 2, 0, 2, 0], fingers: [0, 1, 3, 1, 4, 1] },
  m7:   { offsets: [-1, 0, 2, 0, 1, 0], fingers: [0, 1, 3, 1, 2, 1] },
  maj7: { offsets: [-1, 0, 2, 1, 2, 0], fingers: [0, 1, 3, 2, 4, 1] },
  sus2: { offsets: [-1, 0, 2, 2, 0, 0], fingers: [0, 1, 3, 4, 1, 1] },
  sus4: { offsets: [-1, 0, 2, 2, 3, 0], fingers: [0, 1, 2, 3, 4, 1] },
  '5':  { offsets: [-1, 0, 2, 2, -1, -1], fingers: [0, 1, 3, 4, 0, 0] },
}

/** Chord symbol → root, quality, and whether the quality was simplified. */
function parseSymbol(symbol: string): { root: string; quality: Quality; approx: boolean } | null {
  const m = symbol.match(/^([A-G][#b]?)(.*)$/)
  if (!m) return null
  const root = m[1]
  if (!(root in PITCH_CLASS)) return null
  // Drop slash bass — we play the base chord shape.
  const rest = m[2].split('/')[0]

  const exact: Record<string, Quality> = {
    '': 'maj', maj: 'maj', M: 'maj',
    m: 'min', min: 'min', '-': 'min',
    '7': '7', dom7: '7',
    m7: 'm7', min7: 'm7', '-7': 'm7',
    maj7: 'maj7', M7: 'maj7', Δ7: 'maj7', Δ: 'maj7',
    sus2: 'sus2', sus4: 'sus4', sus: 'sus4',
    '5': '5',
  }
  if (rest in exact) return { root, quality: exact[rest], approx: false }

  // Unknown extension → nearest supported quality, flagged as approximate.
  if (/^m(?!aj)/.test(rest)) {
    return { root, quality: /7|9|11|13/.test(rest) ? 'm7' : 'min', approx: true }
  }
  if (/^(maj|M)/.test(rest)) return { root, quality: 'maj7', approx: true }
  if (/^(7|9|11|13)/.test(rest)) return { root, quality: '7', approx: true }
  if (/^(add|6|aug|\+)/.test(rest)) return { root, quality: 'maj', approx: true }
  if (/^(dim|°|o)/.test(rest)) return { root, quality: 'min', approx: true }
  if (/^sus/.test(rest)) return { root, quality: 'sus4', approx: true }
  return null
}

export interface ResolvedChord {
  symbol: string
  shape: ChordShape
  /** True when we substituted the closest playable quality. */
  approx: boolean
}

/** True if the token reads as a chord symbol (used by the tab parser). */
export function looksLikeChord(token: string): boolean {
  return parseSymbol(token) !== null
}

export function resolveChord(symbol: string): ResolvedChord | null {
  const parsed = parseSymbol(symbol)
  if (!parsed) return null

  // Prefer hand-curated open shapes when the plain symbol is in the dictionary.
  const dictKey = symbol.split('/')[0]
  if (dictKey in CHORDS) {
    return { symbol, shape: { ...CHORDS[dictKey], name: symbol }, approx: false }
  }

  const pc = PITCH_CLASS[parsed.root]
  const eFret = (pc - 4 + 12) % 12 || 12 // root on low E string
  const aFret = (pc - 9 + 12) % 12 || 12 // root on A string

  const candidates: { fret: number; tpl: Template }[] = []
  const eTpl = E_SHAPES[parsed.quality]
  const aTpl = A_SHAPES[parsed.quality]
  if (eTpl) candidates.push({ fret: eFret, tpl: eTpl })
  if (aTpl) candidates.push({ fret: aFret, tpl: aTpl })
  if (candidates.length === 0) return null

  // Lowest playable position wins.
  candidates.sort((a, b) => a.fret - b.fret)
  const { fret, tpl } = candidates[0]

  const frets = tpl.offsets.map((o) => (o < 0 ? -1 : o + fret))
  const fingers = fret === 0
    ? tpl.offsets.map((o, i) => (o <= 0 ? 0 : tpl.fingers[i]))
    : [...tpl.fingers]

  return {
    symbol,
    shape: { name: symbol, frets, fingers, baseFret: Math.max(1, fret) },
    approx: parsed.approx,
  }
}
