import { stepMidiNotes, type ParsedStep } from './tabParser'

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
