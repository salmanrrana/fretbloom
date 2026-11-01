import { expect, test } from 'vitest'
import {
  alignmentTarget,
  chordPitchClasses,
  CHORD_INTERVALS,
  parseChordIdentity,
} from './chordIdentity'
import { parseTab } from './tabParser'

test('parses the full vocabulary, slash bass and add2 convention', () => {
  const names = [
    'C',
    'Cm',
    'C7',
    'Cmaj7',
    'Cm7',
    'Csus2',
    'Csus4',
    'Cadd9',
    'Cmadd9',
    'Cadd11',
    'Cmadd11',
    'C6',
    'Cm6',
    'Cdim',
    'Cdim7',
    'Cm7b5',
    'Caug',
    'C5',
  ]
  expect(
    new Set(names.map((name) => parseChordIdentity(name)?.quality)).size,
  ).toBe(Object.keys(CHORD_INTERVALS).length)
  expect(parseChordIdentity('Dbm7/Ab')).toEqual({
    rootPc: 1,
    quality: 'min7',
    bassPc: 8,
  })
  expect(parseChordIdentity('Cadd2')).toEqual(parseChordIdentity('Cadd9'))
  expect(parseChordIdentity('C13')).toBeNull()
  expect(parseChordIdentity('C/something')).toBeNull()
})
test('diminished and added chord targets are independent of approximate diagrams', () => {
  const steps = parseTab('Cdim Cadd9 C7/E').steps
  expect(steps).toHaveLength(3)
  expect(alignmentTarget(steps[0]).midis).toEqual([60, 63, 66])
  expect(alignmentTarget(steps[1]).midis).toEqual([60, 62, 64, 67])
  expect(alignmentTarget(steps[2]).midis).toEqual([60, 64, 67, 70])
})
test('capo shifts canonical chord targets while numbered tabs keep exact MIDI', () => {
  const chord = parseTab('Capo: 2\nCdim').steps[0]
  expect(alignmentTarget(chord).midis).toEqual([62, 65, 68])
  const tab = parseTab(
    'e|--0--2--|\nB|--------|\nG|--------|\nD|--------|\nA|--------|\nE|--------|',
  ).steps
  expect(tab.map(alignmentTarget).map((t) => t.midis)).toEqual([[64], [66]])
  expect(chordPitchClasses({ rootPc: 0, quality: 'maj', bassPc: 2 })).toEqual([
    0, 2, 4, 7,
  ])
})
