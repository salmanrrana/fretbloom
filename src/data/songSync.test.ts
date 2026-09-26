import { expect, test } from 'vitest'
import { parseTab } from './tabParser'
import {
  chordAt,
  matchingSequence,
  nextChangeIndex,
  sheetChords,
  stepAtTime,
  validSyncTimes,
} from './songSync'

test('sync survives lyric edits but is invalidated by changed pitches or order', () => {
  const before = parseTab('C G\nHello').steps
  expect(matchingSequence(before, parseTab('C G\nGoodbye').steps)).toBe(true)
  expect(matchingSequence(before, parseTab('G C').steps)).toBe(false)
  expect(matchingSequence(before, parseTab('Capo: 2\nC G').steps)).toBe(false)
})

test('rejects corrupt and incomplete timing maps', () => {
  expect(validSyncTimes([0, 2, 4], 3)).toBe(true)
  for (const bad of [
    [0, 0, 2],
    [2, 1, 3],
    [-1, 0, 1],
    [0, NaN, 2],
    [0, Infinity, 2],
    [0, 1],
    ['0', 1, 2],
    null,
  ]) {
    expect(validSyncTimes(bad, 3)).toBe(false)
  }
})

test('playback and seeking select the correct event through intro and outro', () => {
  const times = [2, 4, 7]
  expect(
    [0, 2, 3.9, 4, 6, 7, 20].map((time) => stepAtTime(times, time)),
  ).toEqual([0, 0, 0, 1, 1, 2, 2])
})

test('a synced sheet becomes timed chords that end where the next begins', () => {
  const steps = parseTab('C C G').steps
  const chords = sheetChords(steps, [1, 3, 5], 8)
  expect(chords).toEqual([
    { label: 'C', start: 1, end: 3 },
    { label: 'C', start: 3, end: 5 },
    { label: 'G', start: 5, end: 8 },
  ])
  // Before the first chord starts, "now" is the first chord: get ready.
  expect(chordAt(chords, 0)?.start).toBe(1)
  expect(chordAt(chords, 3)?.label).toBe('C')
  expect(chordAt(chords, 7.9)?.label).toBe('G')
  expect(chordAt(chords, 8)).toBeUndefined()
})

test('up next names the next chord change, skipping repeats', () => {
  const steps = parseTab('C C G G Am').steps
  expect([0, 1, 2, 3, 4].map((i) => nextChangeIndex(steps, i))).toEqual([
    2, 2, 4, 4, -1,
  ])
})
