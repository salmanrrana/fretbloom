import { looksLikeChord, resolveChord, type ResolvedChord } from './chordEngine'

/**
 * Pulls the chord sequence out of pasted song text. Handles the two formats
 * that cover essentially every tab site:
 *   1. Chord lines above lyric lines:   "G        Cadd9\nHere comes the sun"
 *   2. Inline bracket chords:           "[G]Here comes the [C]sun"
 * Section headers like [Verse] / [Chorus] are kept as markers.
 */

export interface ParsedStep {
  chord: ResolvedChord
  /** Section this chord belongs to ("Verse 1", "Chorus", …), if any. */
  section: string | null
}

export interface ParsedTab {
  steps: ParsedStep[]
  /** Symbols we could not resolve to any shape. */
  unknown: string[]
}

const SECTION_RE = /^\[?\s*(intro|verse|chorus|bridge|outro|pre[- ]?chorus|solo|interlude|refrain|instrumental)\s*\d*\s*\]?:?\s*$/i

/** A line is a "chord line" when every real token parses as a chord. */
function chordTokens(line: string): string[] | null {
  const tokens = line.split(/[\s|,]+/).filter((t) => t && !/^[-–—x×/%.]+$/.test(t))
  if (tokens.length === 0) return null
  const cleaned = tokens.map((t) => t.replace(/^\(|\)$/g, ''))
  return cleaned.every(looksLikeChord) ? cleaned : null
}

export function parseTab(text: string): ParsedTab {
  const steps: ParsedStep[] = []
  const unknown = new Set<string>()
  let section: string | null = null

  const addSymbol = (symbol: string) => {
    const resolved = resolveChord(symbol)
    if (resolved) {
      // Collapse immediate repeats (chord lines often repeat per lyric line).
      const last = steps[steps.length - 1]
      if (last && last.chord.symbol === symbol && last.section === section) return
      steps.push({ chord: resolved, section })
    } else {
      unknown.add(symbol)
    }
  }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const sectionMatch = line.match(SECTION_RE)
    if (sectionMatch) {
      section = sectionMatch[1].replace(/^\w/, (c) => c.toUpperCase())
      continue
    }

    // Skip ASCII tab staff lines (e|---0---) — chords come from chord lines.
    if (/^[eEBGDAa]\s*\|/.test(line) && /[-0-9]/.test(line)) continue

    // Inline [G] style
    const inline = [...line.matchAll(/\[([A-G][#b]?[^\]\s]*)\]/g)]
    if (inline.length > 0) {
      for (const m of inline) addSymbol(m[1])
      continue
    }

    const tokens = chordTokens(line)
    if (tokens) for (const t of tokens) addSymbol(t)
  }

  return { steps, unknown: [...unknown] }
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
