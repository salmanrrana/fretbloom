import type { DetectedNote } from '../audio/songAnalysisTypes'
import { chordRuns, type TimedChord } from './songSync'

export interface LyricCue {
  start: number
  end: number
  text: string
}

export interface SongLyrics {
  videoId: string
  source: 'captions' | 'pasted' | 'lyrics'
  language: string | null
  automatic: boolean
  /** Null until all pasted lines have been timed. */
  cues: LyricCue[] | null
  text: string
}

export interface CaptionResult {
  status: 'available' | 'unavailable'
  language: string | null
  automatic: boolean
  cues: LyricCue[]
}

/** Notes belong to the line sounding at their onset, once only, in time order. */
export function notesForLyrics(
  cues: readonly LyricCue[],
  notes: readonly DetectedNote[],
): DetectedNote[][] {
  const grouped = cues.map(() => [] as DetectedNote[])
  for (const note of notes) {
    const index = cues.findIndex(
      (cue) => note.start >= cue.start && note.start < cue.end,
    )
    if (index >= 0) grouped[index].push(note)
  }
  return grouped
}

/** LRC timestamps are used as supplied; plain text is never spread over an invented tempo. */
export function parseLyrics(
  text: string,
  duration: number,
): { lines: string[]; cues: LyricCue[] | null } {
  const raw = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000
  const timed: { start: number; text: string }[] = []
  let hasUntimed = false
  for (const line of raw) {
    if (/^\[(?:ar|ti|al|by|offset|length):/i.test(line)) continue
    const stamps = [
      ...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g),
    ]
    const words = line.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim()
    if (!words && !stamps.length) continue
    if (!stamps.length) hasUntimed = true
    for (const stamp of stamps) {
      const seconds = Number(stamp[2])
      const start =
        Number(stamp[1]) * 60 + seconds + Number(`0.${stamp[3] ?? 0}`) - offset
      if (seconds >= 60 || start < 0 || start >= duration) {
        hasUntimed = true
        continue
      }
      timed.push({ start, text: words })
    }
  }
  const lines = raw
    .filter((line) => !/^\[(?:ar|ti|al|by|offset|length):/i.test(line))
    .map((line) =>
      line.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim(),
    )
    .filter(Boolean)
  timed.sort((a, b) => a.start - b.start)
  if (
    !timed.length ||
    hasUntimed ||
    timed.some((cue, i) => i > 0 && cue.start <= timed[i - 1].start)
  )
    return { lines, cues: null }
  return {
    lines,
    cues: timed
      .map((cue, i) => ({
        ...cue,
        end: timed[i + 1]?.start ?? duration,
      }))
      .filter((cue) => cue.text.length > 0),
  }
}

export interface LyricRow extends LyricCue {
  /** Chords struck during the line; empty when the song has none. */
  chords: TimedChord[]
  /** A chord still ringing from before the line, to keep holding. */
  held: TimedChord | null
  /** Single-note estimates, used only when no chords were found at all. */
  notes: DetectedNote[]
  instrumental: boolean
}

/** A strum this close before a line's first word leads into that line. */
const LEAD_IN = 0.35

/**
 * Each chord change is listed once, under the line it is struck in; a strum
 * just before the words counts for the line it leads into. Repeats of one
 * chord are merged first. A line that opens while an earlier chord still
 * rings gets it as `held` (keep holding), never as a new chord to play.
 */
export function chordsForLyrics(
  cues: readonly LyricCue[],
  chords: readonly TimedChord[],
): Pick<LyricRow, 'chords' | 'held'>[] {
  const runs = chordRuns(chords)
  return cues.map((cue, i) => {
    const next = cues[i + 1]
    const from = cue.start - LEAD_IN
    const until =
      next && next.start - cue.end < LEAD_IN ? next.start - LEAD_IN : cue.end
    return {
      chords: runs.filter((run) => run.start >= from && run.start < until),
      // Ringing under 0.2 s into the line is boundary jitter, not a hold.
      held:
        runs.find((run) => run.start < from && run.end > cue.start + 0.2) ??
        null,
    }
  })
}

function timingMarkup(text: string): string {
  return JSON.stringify(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/\[(?:\d+:|offset:)[^\]]*\]/gi) ?? []),
  )
}

/** Word corrections preserve marks; edits to timestamp markers replace them. */
export function editedLyricCues(
  text: string,
  duration: number,
  saved?: SongLyrics,
): LyricCue[] | null {
  if (text === saved?.text) return saved.cues
  const next = parseLyrics(text, duration)
  // Explicit LRC is ordered by its timestamps, not by the order of source lines.
  if (next.cues) return next.cues
  if (
    saved?.cues &&
    next.lines.length === saved.cues.length &&
    (!/\[\d+:/.test(text) || timingMarkup(text) === timingMarkup(saved.text))
  )
    return saved.cues.map((cue, index) => ({ ...cue, text: next.lines[index] }))
  return next.cues
}

/**
 * Lines plus the introductions and breaks between them, each with what sounds
 * during it. Chords are the play-along; single notes only stand in when
 * nothing was recognized. Silent breaks are dropped.
 */
export function lyricRows(
  cues: readonly LyricCue[],
  chords: readonly TimedChord[],
  notes: readonly DetectedNote[],
  duration: number,
): LyricRow[] {
  const rows: LyricRow[] = []
  let cursor = 0
  const gap = (start: number, end: number): LyricRow => ({
    start,
    end,
    text: 'Instrumental / no lyrics',
    chords: [],
    held: null,
    notes: [],
    instrumental: true,
  })
  for (const cue of cues) {
    if (cue.start > cursor) rows.push(gap(cursor, cue.start))
    rows.push({
      ...cue,
      chords: [],
      held: null,
      notes: [],
      instrumental: false,
    })
    cursor = cue.end
  }
  if (cursor < duration) rows.push(gap(cursor, duration))
  const chordGroups = chordsForLyrics(rows, chords)
  const noteGroups = chords.length
    ? rows.map(() => [])
    : notesForLyrics(rows, notes)
  return rows
    .map((row, i) => ({ ...row, ...chordGroups[i], notes: noteGroups[i] }))
    .filter(
      (row) =>
        !row.instrumental || row.chords.length || row.held || row.notes.length,
    )
}

/** Reject malformed remote timing rather than attaching words to arbitrary notes. */
export function readCaptions(
  value: unknown,
  duration: number,
): CaptionResult | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('status' in value) ||
    !('cues' in value) ||
    !Array.isArray(value.cues)
  )
    return null
  if (value.status !== 'available' && value.status !== 'unavailable')
    return null
  if (value.cues.length > 5000) return null
  const cues: LyricCue[] = []
  for (const cue of value.cues) {
    if (
      !cue ||
      typeof cue !== 'object' ||
      typeof cue.start !== 'number' ||
      typeof cue.end !== 'number' ||
      !Number.isFinite(cue.start) ||
      !Number.isFinite(cue.end) ||
      cue.start < 0 ||
      cue.end <= cue.start ||
      typeof cue.text !== 'string' ||
      cue.text.length > 10000 ||
      (cues.length > 0 && cue.start < cues[cues.length - 1].end)
    )
      return null
    if (cue.start < duration && cue.text.trim())
      cues.push({
        start: cue.start,
        end: Math.min(duration, cue.end),
        text: cue.text.trim(),
      })
  }
  return {
    status: cues.length ? 'available' : 'unavailable',
    cues,
    language:
      'language' in value && typeof value.language === 'string'
        ? value.language
        : null,
    automatic: 'automatic' in value && value.automatic === true,
  }
}
