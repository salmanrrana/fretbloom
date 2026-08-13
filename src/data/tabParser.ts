import { looksLikeChord, resolveChord, type ResolvedChord } from './chordEngine'

/**
 * Parses pasted song text into two synchronized views:
 *   - `steps`: the flat chord sequence you walk through while playing
 *   - `lines`: the whole sheet, laid out like the paste, with every chord
 *     occurrence linked to its step so the sheet can light up as you go
 * Handles the two formats that cover essentially every tab site:
 *   1. Chord lines above lyric lines:   "G        Cadd9\nHere comes the sun"
 *   2. Inline bracket chords:           "[G]Here comes the [C]sun"
 * Section headers like [Verse] / [Chorus] are kept as markers.
 */

export interface ParsedStep {
  chord: ResolvedChord
  /** Section this chord belongs to ("Verse 1", "Chorus", …), if any. */
  section: string | null
}

export type SheetSegment =
  | { kind: 'text'; text: string }
  /** A chord occurrence; `step` indexes into `steps` (-1 if unresolved). */
  | { kind: 'chord'; text: string; step: number }

export interface SheetLine {
  kind: 'section' | 'staff' | 'lyric' | 'chords' | 'blank'
  segments: SheetSegment[]
}

export interface ParsedTab {
  steps: ParsedStep[]
  lines: SheetLine[]
  /** Symbols we could not resolve to any shape. */
  unknown: string[]
}

const SECTION_RE = /^\[?\s*(intro|verse|chorus|bridge|outro|pre[- ]?chorus|solo|interlude|refrain|instrumental)\s*\d*\s*\]?:?\s*$/i

/** Tokens like "x2", "-", "%" that decorate chord lines without being chords. */
const FILLER_RE = /^[-–—x×/%.]+$/

/** A line is a "chord line" when every real token parses as a chord. */
function isChordLine(line: string): boolean {
  const tokens = line.split(/[\s|,]+/).filter((t) => t && !FILLER_RE.test(t))
  if (tokens.length === 0) return false
  return tokens.every((t) => looksLikeChord(t.replace(/^\(|\)$/g, '')))
}

export function parseTab(text: string): ParsedTab {
  const steps: ParsedStep[] = []
  const lines: SheetLine[] = []
  const unknown = new Set<string>()
  let section: string | null = null

  /** Resolve a symbol into a step; returns the step index or -1. */
  const addSymbol = (symbol: string): number => {
    const resolved = resolveChord(symbol)
    if (resolved) {
      steps.push({ chord: resolved, section })
      return steps.length - 1
    }
    unknown.add(symbol)
    return -1
  }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()

    if (!line) {
      lines.push({ kind: 'blank', segments: [] })
      continue
    }

    const sectionMatch = line.match(SECTION_RE)
    if (sectionMatch) {
      section = sectionMatch[1].replace(/^\w/, (c) => c.toUpperCase())
      lines.push({ kind: 'section', segments: [{ kind: 'text', text: line }] })
      continue
    }

    // ASCII tab staff lines (e|---0---) are kept for display but chords come
    // from chord lines, not staff notes.
    if (/^[eEBGDAa]\s*\|/.test(line) && /[-0-9]/.test(line)) {
      lines.push({ kind: 'staff', segments: [{ kind: 'text', text: rawLine }] })
      continue
    }

    // Inline [G] style — split the line around each bracket chord.
    const inline = [...rawLine.matchAll(/\[([A-G][#b]?[^\]\s]*)\]/g)]
    if (inline.length > 0) {
      const segments: SheetSegment[] = []
      let cursor = 0
      for (const m of inline) {
        if (m.index! > cursor) segments.push({ kind: 'text', text: rawLine.slice(cursor, m.index) })
        segments.push({ kind: 'chord', text: m[1], step: addSymbol(m[1]) })
        cursor = m.index! + m[0].length
      }
      if (cursor < rawLine.length) segments.push({ kind: 'text', text: rawLine.slice(cursor) })
      lines.push({ kind: 'chords', segments })
      continue
    }

    if (isChordLine(line)) {
      // Chord line: keep the original spacing so chords stay over their lyrics.
      const segments: SheetSegment[] = []
      let cursor = 0
      for (const m of rawLine.matchAll(/[^\s|,]+/g)) {
        const token = m[0]
        if (m.index! > cursor) segments.push({ kind: 'text', text: rawLine.slice(cursor, m.index) })
        if (FILLER_RE.test(token)) {
          segments.push({ kind: 'text', text: token })
        } else {
          segments.push({ kind: 'chord', text: token, step: addSymbol(token.replace(/^\(|\)$/g, '')) })
        }
        cursor = m.index! + token.length
      }
      if (cursor < rawLine.length) segments.push({ kind: 'text', text: rawLine.slice(cursor) })
      lines.push({ kind: 'chords', segments })
      continue
    }

    lines.push({ kind: 'lyric', segments: [{ kind: 'text', text: rawLine }] })
  }

  return { steps, lines, unknown: [...unknown] }
}

/** Extract a YouTube video ID from any of the usual URL forms. */
export function youtubeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed
  const patterns = [
    /youtube\.com\/watch\?.*v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ]
  for (const re of patterns) {
    const m = trimmed.match(re)
    if (m) return m[1]
  }
  return null
}
