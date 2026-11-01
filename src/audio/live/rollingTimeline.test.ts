import { describe, it, expect } from 'vitest'
import { DEFAULT_OPTIONS } from '../analysisV1'
import type { AnalysisResult } from '../analysisV1'
import { RollingTimeline } from './rollingTimeline'
const key = { sessionId: '77dd02f6-1d87-4e24-97a0-411c91795a82', generation: 1 }
function sustained(duration: number): AnalysisResult {
  return {
    schemaVersion: 1,
    engineVersion: 'test',
    options: DEFAULT_OPTIONS,
    duration,
    sampleRateHz: 24000,
    timingResolutionSeconds: 0.02,
    tuning: { referenceHz: 440, estimatedOffsetCents: null },
    harmony: [
      {
        start: 0,
        end: duration,
        kind: 'unknown',
        reason: 'ambiguous',
        alternatives: [],
        bass: null,
      },
    ],
    monophonicNotes: [
      {
        start: 0,
        end: duration,
        midi: 69,
        name: 'A4',
        cents: 0,
        evidence: { score: 0.9, margin: 0.3, level: 'high' },
      },
    ],
    polyphonicNotes: [],
    warnings: [],
  }
}
describe('rolling evidence ledger', () => {
  it.each(['monophonicNotes', 'polyphonicNotes'] as const)(
    'preserves adjacent same-pitch attacks in %s',
    (stream) => {
      const ledger = new RollingTimeline(key, 0, 0)
      const result = sustained(1.28)
      const note = result.monophonicNotes[0]
      result.monophonicNotes = []
      result[stream] = [
        { ...note, start: 0, end: 0.32 },
        { ...note, start: 0.32, end: 0.64 },
        { ...note, start: 0.64, end: 1.28 },
      ]
      const patch = ledger.apply(result, 0, 30720, true)
      expect(patch?.[stream].map(({ start, end }) => [start, end])).toEqual([
        [0, 0.32],
        [0.32, 0.64],
        [0.64, 1.28],
      ])
      expect(new Set(patch?.[stream].map((n) => n.id)).size).toBe(3)
      expect(
        ledger.snapshot(30720, 'test', DEFAULT_OPTIONS).result[stream],
      ).toHaveLength(3)
    },
  )
  it.each([0.62, 0.64, 0.66])(
    'preserves a reattack at %s seconds around the replacement cut',
    (attack) => {
      // Nonzero segment offset also checks that origin identities use global samples.
      const segmentStart = 24000
      const ledger = new RollingTimeline(key, 1, segmentStart)
      const first = sustained(1.28)
      const note = first.monophonicNotes[0]
      first.monophonicNotes = [
        { ...note, end: attack },
        { ...note, start: attack },
      ]
      const firstPatch = ledger.apply(first, segmentStart, segmentStart + 30720)
      expect(firstPatch?.settledThroughSample).toBe(segmentStart + 15360)
      const attackId = firstPatch?.monophonicNotes.find(
        (n) =>
          Math.round(n.start * 24000) ===
          segmentStart + Math.round(attack * 24000),
      )?.id
      const second = sustained(1.92)
      second.monophonicNotes = [
        { ...note, end: attack },
        { ...note, start: attack, end: 1.92 },
      ]
      const secondPatch = ledger.apply(
        second,
        segmentStart,
        segmentStart + 46080,
        true,
      )
      const notes = ledger.snapshot(
        segmentStart + 46080,
        'test',
        DEFAULT_OPTIONS,
      ).result.monophonicNotes
      expect(notes.map(({ start, end }) => [start, end])).toEqual([
        [0, attack],
        [attack, 1.92],
      ])
      expect(attackId).toBeDefined()
      expect(secondPatch?.monophonicNotes.at(-1)?.id).toBe(attackId)
    },
  )
  it('keeps the held companion voice intact when another voice reattacks', () => {
    const ledger = new RollingTimeline(key, 0, 0)
    const result = sustained(1.28)
    const note = result.monophonicNotes[0]
    result.monophonicNotes = []
    result.polyphonicNotes = [
      { ...note, end: 0.64 },
      { ...note, start: 0.64 },
      { ...note, midi: 64, name: 'E4' },
    ]
    ledger.apply(result, 0, 30720, true)
    const notes = ledger.snapshot(30720, 'test', DEFAULT_OPTIONS).result
      .polyphonicNotes
    expect(notes.filter((n) => n.midi === 69)).toHaveLength(2)
    expect(
      notes.filter((n) => n.midi === 64).map(({ start, end }) => [start, end]),
    ).toEqual([[0, 1.28]])
  })
  it('uses the original event boundary from a shifted analysis window', () => {
    const ledger = new RollingTimeline(key, 0, 0)
    const first = ledger.apply(sustained(2.56), 0, 61440)
    const firstId = first?.monophonicNotes[0].id
    expect(first?.settledThroughSample).toBe(46080)
    const next = sustained(2.56)
    next.monophonicNotes = [
      { ...next.monophonicNotes[0], end: 1.28 },
      { ...next.monophonicNotes[0], start: 1.28 },
    ]
    // Window offset .64 s plus local onset 1.28 s is exactly the 1.92 s cut.
    ledger.apply(next, 15360, 76800, true)
    const notes = ledger.snapshot(76800, 'test', DEFAULT_OPTIONS).result
      .monophonicNotes
    expect(notes.map(({ start, end }) => [start, end])).toEqual([
      [0, 1.92],
      [1.92, 3.2],
    ])
    expect(notes[0]).toMatchObject({ id: firstId })
    expect(notes[1]).toMatchObject({ id: '0:mono:69:46080' })
    expect(notes.every((note) => !('originStartSample' in note))).toBe(true)
  })
  it('keeps a held note onset/ID and settled prefix across many seams', () => {
    const ledger = new RollingTimeline(key, 0, 0)
    const first = ledger.apply(sustained(1.28), 0, 30720)
    expect(first?.replaceToSample).toBe(23040)
    expect(first?.settledThroughSample).toBe(15360)
    const id = first?.monophonicNotes[0].id
    for (let end = 46080; end < 240000; end += 15360)
      ledger.apply(
        sustained(Math.min(end, 61440) / 24000),
        Math.max(0, end - 61440),
        end,
      )
    const snapshot = ledger.snapshot(245760, 'test', DEFAULT_OPTIONS)
    expect(snapshot.result.monophonicNotes).toHaveLength(1)
    expect(snapshot.result.monophonicNotes[0].start).toBe(0)
    expect(
      ledger.apply(sustained(2.56), 184320, 245760)?.monophonicNotes[0].id,
    ).toBe(id)
  })
  it('marks unsafe coalescing as missed, preserving earlier events', () => {
    const ledger = new RollingTimeline(key, 0, 0)
    ledger.apply(sustained(1.28), 0, 30720)
    const patch = ledger.apply(sustained(2.56), 120000, 181440)
    expect(patch?.missedLiveIntervals?.length).toBe(1)
    expect(
      ledger.snapshot(181440, 'test', DEFAULT_OPTIONS).result.monophonicNotes[0]
        .start,
    ).toBe(0)
  })
  it('does not join supported notes across releases or segments', () => {
    const ledger = new RollingTimeline(key, 1, 24000),
      result = sustained(1.28)
    result.monophonicNotes = [
      { ...result.monophonicNotes[0], end: 0.2 },
      { ...result.monophonicNotes[0], start: 0.3, end: 0.8 },
    ]
    ledger.apply(result, 24000, 54720)
    const notes = ledger.snapshot(54720, 'test', DEFAULT_OPTIONS).result
      .monophonicNotes
    expect(notes).toHaveLength(2)
    expect(notes[0].end).toBe(0.2)
  })
})
