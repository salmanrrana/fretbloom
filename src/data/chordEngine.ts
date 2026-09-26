import { OPEN_STRINGS } from '../audio/notes'
import type { ChordShape } from './chords'
import { CHORDS } from './chords'

/**
 * Turns chord symbols ("F#m7", "Bb", "Cmaj7", "D/F#") into playable shapes.
 * Hand-curated open shapes come from CHORDS; everything else is generated from
 * movable E-shape and A-shape barre templates. Slash chords re-voice the base
 * shape so the written bass note really is the lowest string that sounds.
 */

const PITCH_CLASS: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
}

type Quality = 'maj' | 'min' | '7' | 'm7' | 'maj7' | 'sus2' | 'sus4' | '5'

interface Template {
  offsets: number[]
  fingers: number[]
}

// Offsets are relative to the barre fret; -1 = muted. Low E → high e.
const E_SHAPES: Partial<Record<Quality, Template>> = {
  maj: { offsets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
  min: { offsets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
  '7': { offsets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1] },
  m7: { offsets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1] },
  maj7: { offsets: [0, 2, 1, 1, 0, 0], fingers: [1, 4, 2, 3, 1, 1] },
  sus4: { offsets: [0, 2, 2, 2, 0, 0], fingers: [1, 2, 3, 4, 1, 1] },
  '5': { offsets: [0, 2, 2, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0] },
}

const A_SHAPES: Partial<Record<Quality, Template>> = {
  maj: { offsets: [-1, 0, 2, 2, 2, 0], fingers: [0, 1, 2, 3, 4, 1] },
  min: { offsets: [-1, 0, 2, 2, 1, 0], fingers: [0, 1, 3, 4, 2, 1] },
  '7': { offsets: [-1, 0, 2, 0, 2, 0], fingers: [0, 1, 3, 1, 4, 1] },
  m7: { offsets: [-1, 0, 2, 0, 1, 0], fingers: [0, 1, 3, 1, 2, 1] },
  maj7: { offsets: [-1, 0, 2, 1, 2, 0], fingers: [0, 1, 3, 2, 4, 1] },
  sus2: { offsets: [-1, 0, 2, 2, 0, 0], fingers: [0, 1, 3, 4, 1, 1] },
  sus4: { offsets: [-1, 0, 2, 2, 3, 0], fingers: [0, 1, 2, 3, 4, 1] },
  '5': { offsets: [-1, 0, 2, 2, -1, -1], fingers: [0, 1, 3, 4, 0, 0] },
}

/** Whole-suffix gate so lyric words ("Goodbye" → G + "oodbye") never read as chords. */
const SUFFIX_RE =
  /^(?:maj|min|m|M|dom|dim|aug|sus|add|Δ|°|o|\+|-)?\d{0,2}(?:(?:add|sus|[#b])\d{1,2})*$/

/**
 * Chord suffix → template quality; the first matching row wins. Whole-suffix
 * spellings come first, then loose prefixes that map extensions we don't
 * voice (9ths, dim, add…) onto the nearest quality, flagged approximate.
 */
const SUFFIXES: { re: RegExp; quality: Quality; approx: boolean }[] = [
  { re: /^(?:maj|M)?$/, quality: 'maj', approx: false },
  { re: /^(?:m|min|-)$/, quality: 'min', approx: false },
  { re: /^(?:7|dom7)$/, quality: '7', approx: false },
  { re: /^(?:m7|min7|-7)$/, quality: 'm7', approx: false },
  { re: /^(?:maj7|M7|Δ7?)$/, quality: 'maj7', approx: false },
  { re: /^sus2$/, quality: 'sus2', approx: false },
  { re: /^sus4?$/, quality: 'sus4', approx: false },
  { re: /^5$/, quality: '5', approx: false },
  { re: /^m(?!aj).*(?:7|9|11|13)/, quality: 'm7', approx: true },
  { re: /^m(?!aj)/, quality: 'min', approx: true },
  { re: /^(?:maj|M)/, quality: 'maj7', approx: true },
  { re: /^(?:7|9|11|13)/, quality: '7', approx: true },
  { re: /^(?:add|6|aug|\+)/, quality: 'maj', approx: true },
  { re: /^(?:dim|°|o)/, quality: 'min', approx: true },
  { re: /^sus/, quality: 'sus4', approx: true },
]

interface ParsedSymbol {
  /** Symbol without the slash bass, e.g. "Am7" for "Am7/G". */
  base: string
  root: string
  quality: Quality
  approx: boolean
  bass: string | null
}

/** Chord symbol → root, quality, slash bass, and whether the quality was simplified. */
function parseSymbol(symbol: string): ParsedSymbol | null {
  const [base, bass, extra] = symbol.split('/')
  const m = base.match(/^([A-G][#b]?)(.*)$/)
  if (!m || !(m[1] in PITCH_CLASS)) return null
  if (extra !== undefined || (bass !== undefined && !(bass in PITCH_CLASS)))
    return null
  if (!SUFFIX_RE.test(m[2])) return null
  const hit = SUFFIXES.find(({ re }) => re.test(m[2]))
  if (!hit) return null
  return {
    base,
    root: m[1],
    quality: hit.quality,
    approx: hit.approx,
    bass: bass ?? null,
  }
}

/**
 * Movable barre shape with the root on the low E or A string, whichever sits
 * lower on the neck. A root that lands on fret 0 (E, A and their qualities)
 * is the open-position chord, not a 12th-fret barre: same shape, so we drop
 * the barre finger and shift the others down one.
 */
function generate(root: number, quality: Quality): ChordShape | null {
  const options = [
    { fret: (root - 4 + 12) % 12, tpl: E_SHAPES[quality] },
    { fret: (root - 9 + 12) % 12, tpl: A_SHAPES[quality] },
  ]
    .filter((o): o is { fret: number; tpl: Template } => o.tpl !== undefined)
    .sort((a, b) => a.fret - b.fret)
  if (options.length === 0) return null
  const { fret, tpl } = options[0]
  return {
    name: '',
    frets: tpl.offsets.map((o) => (o < 0 ? -1 : o + fret)),
    fingers: tpl.fingers.map((f, i) =>
      fret > 0 ? f : tpl.offsets[i] > 0 ? f - 1 : 0,
    ),
    baseFret: Math.max(1, fret),
  }
}

/** Frets one hand comfortably covers, as a distance (4 frets = span 3). */
const HAND_SPAN = 3

/**
 * Re-voice `shape` so `bassPc` is the lowest sounding note: play the bass on
 * whichever low string (E, A or D) reaches it with the least stretch — an
 * open string counts as none — and mute the strings below it. This yields the
 * standard slash voicings (C/E → 032010, C/B → x22010, G/B → x20003,
 * Am/G → 302210, Bm/A → x04432) without a lookup table. `approx` is set when
 * no low string can reach the bass within a hand span.
 */
function withBass(
  shape: ChordShape,
  bassPc: number,
): { shape: ChordShape; approx: boolean } {
  const stopped = shape.frets.filter((f) => f > 0)
  const lo = Math.min(...stopped)
  const hi = Math.max(...stopped)
  const options = [0, 1, 2].map((string) => {
    const fret = (((bassPc - OPEN_STRINGS[string]) % 12) + 12) % 12
    const span = fret === 0 ? 0 : Math.max(hi, fret) - Math.min(lo, fret)
    return { string, fret, span }
  })
  const { string, fret, span } = options.reduce((a, b) =>
    b.span < a.span ? b : a,
  )

  const frets = shape.frets.map((f, i) =>
    i < string ? -1 : i === string ? fret : f,
  )
  const fingers = shape.fingers.map((f, i) => (i < string ? 0 : f))
  // Finger for the bass: none when open, the string's own if it was already
  // fretted, an index barre already at that fret, else the next free finger.
  if (fret === 0) fingers[string] = 0
  else if (shape.frets[string] <= 0) {
    const barre = shape.frets.some(
      (f, i) => i !== string && f === fret && shape.fingers[i] === 1,
    )
    fingers[string] = barre ? 1 : Math.min(4, Math.max(0, ...fingers) + 1)
  }
  return {
    shape: {
      ...shape,
      frets,
      fingers,
      baseFret: fret > 0 ? Math.min(shape.baseFret, fret) : shape.baseFret,
    },
    approx: span > HAND_SPAN,
  }
}

export interface ResolvedChord {
  symbol: string
  shape: ChordShape
  /**
   * True when the shape is a compromise: we substituted the closest playable
   * quality, or a slash bass could not fit under the hand.
   */
  approx: boolean
}

/** True if the token reads as a chord symbol (used by the tab parser). */
export function looksLikeChord(token: string): boolean {
  return parseSymbol(token) !== null
}

/**
 * Symbol → shape. Exact dictionary spellings win (including slash entries such
 * as "D/F#"); otherwise the base chord comes from the dictionary or the barre
 * generator, and a slash bass is voiced onto it.
 */
export function resolveChord(symbol: string): ResolvedChord | null {
  const parsed = parseSymbol(symbol)
  if (!parsed) return null
  if (Object.hasOwn(CHORDS, symbol))
    return { symbol, shape: { ...CHORDS[symbol] }, approx: false }

  const curated = Object.hasOwn(CHORDS, parsed.base)
    ? CHORDS[parsed.base]
    : null
  const base = curated ?? generate(PITCH_CLASS[parsed.root], parsed.quality)
  if (!base) return null
  const voiced =
    parsed.bass === null
      ? { shape: base, approx: false }
      : withBass(base, PITCH_CLASS[parsed.bass])
  return {
    symbol,
    shape: { ...voiced.shape, name: symbol },
    approx: (curated ? false : parsed.approx) || voiced.approx,
  }
}
