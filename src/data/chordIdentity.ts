import type { ChordIdentity, ChordQuality } from '../audio/analysisV1'
import { stepMidiNotes, type ParsedStep } from './tabParser'

const ROOTS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}
export const CHORD_INTERVALS: Record<ChordQuality, readonly number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 2, 4, 7],
  madd9: [0, 2, 3, 7],
  add11: [0, 4, 5, 7],
  madd11: [0, 3, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  hdim7: [0, 3, 6, 10],
  aug: [0, 4, 8],
  '5': [0, 7],
}
const SUFFIXES: Record<string, ChordQuality> = {
  '': 'maj',
  maj: 'maj',
  M: 'maj',
  m: 'min',
  min: 'min',
  '-': 'min',
  '7': 'dom7',
  maj7: 'maj7',
  M7: 'maj7',
  Δ7: 'maj7',
  m7: 'min7',
  min7: 'min7',
  sus2: 'sus2',
  sus4: 'sus4',
  sus: 'sus4',
  add2: 'add9',
  add9: 'add9',
  madd2: 'madd9',
  madd9: 'madd9',
  add11: 'add11',
  madd11: 'madd11',
  '6': '6',
  m6: 'm6',
  dim: 'dim',
  '°': 'dim',
  dim7: 'dim7',
  '°7': 'dim7',
  m7b5: 'hdim7',
  hdim7: 'hdim7',
  ø: 'hdim7',
  ø7: 'hdim7',
  aug: 'aug',
  '+': 'aug',
  '5': '5',
}
function root(note: string, accidental: string): number {
  return (
    (ROOTS[note] +
      (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) +
      12) %
    12
  )
}
/** Identity is independent of the diagram library. add2/add9 share chroma in v1. */
export function parseChordIdentity(symbol: string): ChordIdentity | null {
  const match = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(
    symbol.replace(/♯/g, '#').replace(/♭/g, 'b'),
  )
  if (!match) return null
  const quality = Object.hasOwn(SUFFIXES, match[3])
    ? SUFFIXES[match[3]]
    : undefined
  if (!quality) return null
  return {
    rootPc: root(match[1], match[2]),
    quality,
    bassPc: match[4] ? root(match[4], match[5]) : null,
  }
}
export function chordPitchClasses(
  chord: ChordIdentity,
  transpose = 0,
): number[] {
  return [
    ...new Set(
      [
        ...CHORD_INTERVALS[chord.quality].map(
          (interval) => chord.rootPc + interval,
        ),
        ...(chord.bassPc === null ? [] : [chord.bassPc]),
      ].map((pc) => (pc + transpose + 120) % 12),
    ),
  ].sort((a, b) => a - b)
}
/** Capo is the constant shift between the parser's shape and sounding pitches. */
export function stepCapo(step: ParsedStep): number {
  const sounding = stepMidiNotes(step)
  const shape = step.chord.shape.frets.flatMap((fret, index) =>
    fret === null || fret < 0 ? [] : [OPEN_STRINGS[index] + fret],
  )
  return sounding.length && shape.length ? sounding[0] - shape[0] : 0
}
const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]
export function alignmentTarget(step: ParsedStep) {
  const identity =
    step.kind !== 'notes' ? parseChordIdentity(step.chord.symbol) : null
  return {
    kind: step.kind ?? 'chord',
    label: step.chord.symbol,
    midis: identity
      ? chordPitchClasses(identity, stepCapo(step)).map((pc) => 60 + pc)
      : step.kind === 'notes'
        ? stepMidiNotes(step)
        : [],
  }
}
