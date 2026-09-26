import { stepMidiNotes, type ParsedStep } from './tabParser'

/** A chord and the video time it sounds — from the synced sheet or from recognition. */
export interface TimedChord {
  label: string
  start: number
  end: number
}

/** Timing survives wording edits, but never changed notes, capo, or event order. */
export function matchingSequence(
  before: ParsedStep[],
  after: ParsedStep[],
): boolean {
  return (
    before.length === after.length &&
    before.every((step, index) => {
      const next = after[index]
      return (
        step.chord.symbol === next.chord.symbol &&
        (step.kind ?? 'chord') === (next.kind ?? 'chord') &&
        stepMidiNotes(step).join(',') === stepMidiNotes(next).join(',')
      )
    })
  )
}

export function validSyncTimes(
  times: unknown,
  count: number,
): times is number[] {
  return (
    Array.isArray(times) &&
    count > 0 &&
    times.length === count &&
    times.every(
      (time: unknown, index: number) =>
        typeof time === 'number' &&
        Number.isFinite(time) &&
        time >= 0 &&
        (index === 0 || time > times[index - 1]),
    )
  )
}

/**
 * Step sounding at `time`: the last one that has started, or step 0 before
 * the first starts so the player can get ready. chordAt follows the same
 * rule, so the chord card and the "Now" readout never disagree.
 */
export function stepAtTime(times: number[], time: number): number {
  let low = 0
  let high = times.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (times[mid] <= time) low = mid + 1
    else high = mid
  }
  return Math.max(0, low - 1)
}

/** The synced sheet as timed chords: each step sounds until the next one starts. */
export function sheetChords(
  steps: readonly ParsedStep[],
  times: readonly number[],
  duration: number,
): TimedChord[] {
  return steps.map((step, index) => ({
    label: step.chord.symbol,
    start: times[index],
    end: times[index + 1] ?? Math.max(duration, times[index]),
  }))
}

/** True while `time` falls inside the chord's or note's span. */
export function sounds(
  span: { start: number; end: number },
  time: number,
): boolean {
  return span.start <= time && time < span.end
}

/**
 * The chord to show as "now": the one sounding at `time`, or the first chord
 * before it starts (get ready). Recognized chords can leave gaps ("N"),
 * where there is none.
 */
export function chordAt(
  chords: readonly TimedChord[],
  time: number,
): TimedChord | undefined {
  const first = chords[0]
  if (first && time < first.start) return first
  return chords.find((chord) => sounds(chord, time))
}

/**
 * Index of the next step whose chord differs from step `index`, or -1 when
 * the rest of the sheet stays on the same chord. Runs of one chord are common
 * in pasted sheets, so "up next" should name the change, not the repeat.
 */
export function nextChangeIndex(
  steps: readonly ParsedStep[],
  index: number,
): number {
  const symbol = steps[index]?.chord.symbol
  for (let i = index + 1; i < steps.length; i++)
    if (steps[i].chord.symbol !== symbol) return i
  return -1
}
