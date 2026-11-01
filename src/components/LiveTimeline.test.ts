import { describe, expect, it } from 'vitest'
import {
  EMPTY_TIMELINE,
  applyTimelinePatch,
  timelineLabel,
} from './LiveTimeline'
import type { TimelinePatch } from '../audio/live/protocol'
function patch(revision: number, from: number, to: number): TimelinePatch {
  return {
    sessionId: '35e8c4cf-27f6-4ada-b570-d4cba025f799',
    generation: 1,
    revision,
    segmentId: 0,
    replaceFromSample: from * 24000,
    replaceToSample: to * 24000,
    settledThroughSample: (to - 0.1) * 24000,
    harmony: [],
    monophonicNotes: [],
    polyphonicNotes: [],
    warnings: [],
  }
}
describe('rich live timeline', () => {
  it('clips replacements without erasing settled prefixes or mixing note streams', () => {
    const first = patch(1, 0, 2)
    first.monophonicNotes = [
      {
        start: 0,
        end: 2,
        midi: 64,
        name: 'E4',
        cents: 0,
        evidence: { score: 0.8, margin: 0.2, level: 'high' },
        id: 'held-note',
      },
    ]
    const state = applyTimelinePatch(EMPTY_TIMELINE, first)
    const second = patch(2, 1.5, 3)
    second.polyphonicNotes = [
      { ...first.monophonicNotes[0], start: 2, end: 3, id: 'poly-note' },
    ]
    const updated = applyTimelinePatch(state, second)
    expect(updated.items[0]).toMatchObject({
      stream: 'monophonic',
      event: { start: 0, end: 1.5, id: 'held-note' },
    })
    expect(updated.items[1]).toMatchObject({
      stream: 'polyphonic',
      event: { start: 2, end: 3 },
    })
    expect(applyTimelinePatch(updated, first)).toBe(updated)
  })
  it('keeps cumulative missed-live diagnostics per segment and describes unknown harmony honestly', () => {
    const first = patch(1, 0, 2)
    first.missedLiveIntervals = [
      { segmentId: 0, startSample: 1, endSample: 50 },
    ]
    const state = applyTimelinePatch(EMPTY_TIMELINE, first)
    const second = {
      ...patch(2, 2, 3),
      segmentId: 1,
      missedLiveIntervals: [
        { segmentId: 1, startSample: 50000, endSample: 60000 },
      ],
    }
    expect(applyTimelinePatch(state, second).missed).toHaveLength(2)
    expect(
      timelineLabel({
        segmentId: 0,
        stream: 'harmony',
        event: {
          start: 0,
          end: 1,
          bass: null,
          kind: 'unknown',
          reason: 'ambiguous',
          alternatives: [],
        },
      }),
    ).toBe('Unclear chord')
  })
})

it('extends a held note by stable ID without seam duplicates or mutation of the prior view', () => {
  const first = patch(1, 0, 2)
  first.monophonicNotes = [
    {
      start: 0,
      end: 2,
      midi: 64,
      name: 'E4',
      cents: 0,
      evidence: { score: 0.8, margin: 0.2, level: 'high' },
      id: 'held',
    },
  ]
  const previous = applyTimelinePatch(EMPTY_TIMELINE, first)
  const next = patch(2, 1.5, 3)
  next.monophonicNotes = [{ ...first.monophonicNotes[0], start: 1.5, end: 3 }]
  const updated = applyTimelinePatch(previous, next)
  expect(updated.items).toHaveLength(1)
  expect(updated.items[0].event).toMatchObject({ start: 0, end: 3, id: 'held' })
  expect(previous.items[0].event.end).toBe(2)
})

it('accepts independent revisions after a pause starts another segment', () => {
  const previous = applyTimelinePatch(EMPTY_TIMELINE, patch(10, 0, 2))
  const resumed = { ...patch(1, 2, 3), segmentId: 1 }
  expect(applyTimelinePatch(previous, resumed).revisions).toEqual({
    0: 10,
    1: 1,
  })
})
