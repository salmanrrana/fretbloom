import { OPEN_STRINGS, midiToNameWithOctave } from '../audio/notes'
import { chordMidiNotes } from './chords'
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
  /** Staff events retain their actual pitches; chord steps use the shape plus capo. */
  kind?: 'chord' | 'notes'
  midis?: number[]
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
  warnings: string[]
}

const SECTION_RE =
  /^\[?\s*(intro|verse|chorus|bridge|outro|pre[- ]?chorus|solo|interlude|refrain|instrumental)\s*\d*\s*\]?:?\s*$/i

/** Tokens like "x2", "-", "%" that decorate chord lines without being chords. */
const FILLER_RE = /^(?:[-–—x×/%.]+|[x×]\d+)$/

/** Print junk such as "Page 1/2" or "Page 2 of 3"; treated as a blank line. */
const PAGE_RE = /^page\s*\d+\s*(?:\/|of)\s*\d+$/i

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
  const warnings = new Set<string>()
  const rawLines = text.replace(/\r/g, '').split('\n')
  const capoMatch = text.match(/\bcapo\s*:?\s*(\d+)/i)
  const capo = Math.min(12, Number(capoMatch?.[1] ?? 0))
  const staffGroups = new Map<number, StaffRow[]>()
  for (let i = 0; i < rawLines.length; i++) {
    const rows = rawLines.slice(i, i + 6).map(readStaffRow)
    if (
      rows.length === 6 &&
      rows.every((row): row is StaffRow => row !== null)
    ) {
      if (
        rows.map((row) => row.label.toUpperCase()).join(',') === 'E,B,G,D,A,E'
      ) {
        staffGroups.set(i, rows)
        i += 5
      } else {
        warnings.add(
          'Numbered tabs currently need six strings in standard tuning, from high e to low E.',
        )
      }
    }
  }
  // Only chord lines immediately above a staff are annotations. A later
  // chord-only verse still belongs to the playable sequence.
  const annotations = new Set<number>()
  for (const start of staffGroups.keys()) {
    for (let i = start - 1; i >= 0; i--) {
      const line = rawLines[i].trim()
      if (!line) continue
      if (!readStaffRow(rawLines[i]) && isChordLine(line)) annotations.add(i)
      else break
    }
  }
  let annotationOnly = false
  const tuning = text.match(/\btuning\s*:\s*([^\n]+)/i)?.[1].trim()
  if (tuning && !/^standard\b/i.test(tuning)) {
    warnings.add(
      'Custom tuning is not applied. Note estimates assume standard guitar tuning.',
    )
  }
  let section: string | null = null

  /** Resolve a symbol into a step; returns the step index or -1. */
  const addSymbol = (symbol: string): number => {
    const resolved = resolveChord(symbol)
    if (resolved) {
      if (annotationOnly) return -1
      steps.push({
        chord: resolved,
        section,
        kind: 'chord',
        midis: chordMidiNotes(resolved.shape).map((midi) => midi + capo),
      })
      return steps.length - 1
    }
    unknown.add(symbol)
    return -1
  }

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    annotationOnly = annotations.has(lineIndex)
    const rawLine = rawLines[lineIndex]
    const line = rawLine.trim()
    const staff = staffGroups.get(lineIndex)
    if (staff) {
      const events = new Map<
        number,
        { row: number; fret: number; text: string }[]
      >()
      staff.forEach((row, rowIndex) => {
        for (const match of row.body.matchAll(/\d+/g)) {
          const fret = Number(match[0])
          if (fret > 24) {
            warnings.add('Frets above 24 were skipped.')
            continue
          }
          const at = match.index
          const notes = events.get(at) ?? []
          notes.push({ row: rowIndex, fret, text: match[0] })
          events.set(at, notes)
        }
        if (/[bhp/~<>]/i.test(row.body))
          warnings.add(
            'Tab techniques are shown as written; bends, slides and harmonics are not interpreted.',
          )
      })
      const positions = new Map<number, number>()
      for (const [column, notes] of [...events].sort(([a], [b]) => a - b)) {
        const frets = Array<number>(6).fill(-1)
        for (const note of notes) frets[5 - note.row] = note.fret
        const midis = frets.flatMap((fret, string) =>
          fret < 0 ? [] : [OPEN_STRINGS[string] + fret + capo],
        )
        const symbol = midis.map(midiToNameWithOctave).join(' + ')
        positions.set(column, steps.length)
        const stoppedFrets = frets.filter((fret) => fret > 0)
        const baseFret = stoppedFrets.length ? Math.min(...stoppedFrets) : 1
        steps.push({
          kind: 'notes',
          midis,
          section,
          chord: {
            symbol,
            approx: false,
            shape: {
              name: symbol,
              frets,
              fingers: [0, 0, 0, 0, 0, 0],
              baseFret,
            },
          },
        })
      }
      staff.forEach((row) => {
        const segments: SheetSegment[] = [{ kind: 'text', text: row.prefix }]
        let cursor = 0
        for (const match of row.body.matchAll(/\d+/g)) {
          if (match.index > cursor)
            segments.push({
              kind: 'text',
              text: row.body.slice(cursor, match.index),
            })
          segments.push({
            kind: 'chord',
            text: match[0],
            step:
              Number(match[0]) <= 24 ? (positions.get(match.index) ?? -1) : -1,
          })
          cursor = match.index + match[0].length
        }
        segments.push({
          kind: 'text',
          text: row.body.slice(cursor) + row.annotation,
        })
        lines.push({ kind: 'staff', segments })
      })
      lineIndex += 5
      continue
    }

    if (!line || PAGE_RE.test(line)) {
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
      warnings.add(
        'Incomplete numbered tab: paste all six strings to follow its notes.',
      )
      lines.push({ kind: 'staff', segments: [{ kind: 'text', text: rawLine }] })
      continue
    }

    // Inline [G] style — split the line around each bracket chord.
    const inline = [...rawLine.matchAll(/\[([A-G][#b]?[^\]\s]*)\]/g)]
    if (inline.length > 0) {
      const segments: SheetSegment[] = []
      let cursor = 0
      for (const m of inline) {
        if (m.index! > cursor)
          segments.push({ kind: 'text', text: rawLine.slice(cursor, m.index) })
        segments.push({ kind: 'chord', text: m[1], step: addSymbol(m[1]) })
        cursor = m.index! + m[0].length
      }
      if (cursor < rawLine.length)
        segments.push({ kind: 'text', text: rawLine.slice(cursor) })
      lines.push({ kind: 'chords', segments })
      continue
    }

    if (isChordLine(line)) {
      // Chord line: keep the original spacing so chords stay over their lyrics.
      const segments: SheetSegment[] = []
      let cursor = 0
      for (const m of rawLine.matchAll(/[^\s|,]+/g)) {
        const token = m[0]
        if (m.index! > cursor)
          segments.push({ kind: 'text', text: rawLine.slice(cursor, m.index) })
        if (FILLER_RE.test(token)) {
          segments.push({ kind: 'text', text: token })
        } else {
          segments.push({
            kind: 'chord',
            text: token,
            step: addSymbol(token.replace(/^\(|\)$/g, '')),
          })
        }
        cursor = m.index! + token.length
      }
      if (cursor < rawLine.length)
        segments.push({ kind: 'text', text: rawLine.slice(cursor) })
      lines.push({ kind: 'chords', segments })
      continue
    }

    lines.push({ kind: 'lyric', segments: [{ kind: 'text', text: rawLine }] })
  }

  if (annotations.size > 0)
    warnings.add(
      'Chord names immediately above a numbered tab are kept as annotations.',
    )
  if (/\bx\s*[2-9]\b|repeat/i.test(text))
    warnings.add(
      'Repeat marks are not expanded. Paste each repeat in playing order for automatic sync.',
    )
  return { steps, lines, unknown: [...unknown], warnings: [...warnings] }
}

interface StaffRow {
  label: string
  prefix: string
  body: string
  annotation: string
}

function readStaffRow(line: string): StaffRow | null {
  const match = line.match(/^(\s*([eEBGDA])\s*\|)(.*)$/)
  if (!match || !/[-0-9]/.test(match[3])) return null
  const body = match[3]
  const lastBar = body.lastIndexOf('|')
  const trailing = body.slice(lastBar + 1)
  // Keep unclosed measures, but never interpret a repeat count or comment as frets.
  const annotated =
    lastBar >= 0 &&
    (/^\s*[x×]\s*\d+/i.test(trailing) ||
      !/^[\s\d\-:hpb/r~\\x<>]*$/i.test(trailing))
  return {
    prefix: match[1],
    label: match[2],
    body: annotated ? body.slice(0, lastBar + 1) : body,
    annotation: annotated ? trailing : '',
  }
}

/** Actual sounding pitches, including a parsed capo when present. */
export function stepMidiNotes(step: ParsedStep): number[] {
  return step.midis ?? chordMidiNotes(step.chord.shape)
}

/** Extract a YouTube video ID from any of the usual URL forms. */
export function youtubeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed
  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    )
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null
    const host = url.hostname.toLowerCase()
    let id: string | null = null
    if (host === 'youtu.be' || host === 'www.youtu.be')
      id = url.pathname.split('/')[1]
    else if (
      [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'music.youtube.com',
        'youtube-nocookie.com',
        'www.youtube-nocookie.com',
      ].includes(host)
    ) {
      const parts = url.pathname.split('/')
      if (parts[1] === 'watch') id = url.searchParams.get('v')
      else if (['embed', 'shorts', 'live'].includes(parts[1])) id = parts[2]
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}
