import { expect, test } from 'vitest'
import {
  DEFAULT_OPTIONS,
  parseAnalysisResult,
  parseAlignmentFeatures,
  parseJob,
  parseResultEnvelope,
  parseSource,
} from './analysisV1'

function analysis() {
  return {
    schemaVersion: 1,
    engineVersion: 'rust-dsp-1',
    options: DEFAULT_OPTIONS,
    duration: 1,
    sampleRateHz: 24000,
    timingResolutionSeconds: 0.02,
    tuning: { referenceHz: 440, estimatedOffsetCents: null },
    harmony: [
      { start: 0, end: 1, bass: null, kind: 'no_chord', reason: 'silence' },
    ],
    monophonicNotes: [],
    polyphonicNotes: [],
    warnings: [],
  }
}
test('accepts silent analysis and extra fields, rejects coercion and schema drift', () => {
  expect(
    parseAnalysisResult({ ...analysis(), future: true }).harmony[0].kind,
  ).toBe('no_chord')
  for (const change of [
    { schemaVersion: 2 },
    { duration: '1' },
    { duration: Infinity },
    { sampleRateHz: 12000 },
    { timingResolutionSeconds: 0.04 },
  ])
    expect(() => parseAnalysisResult({ ...analysis(), ...change })).toThrow()
})
test('rejects uncovered, overlapping and invalid harmony spans', () => {
  const base = analysis()
  for (const [start, end] of [
    [-1, 1],
    [0, 0],
    [0, 2],
    [0.1, 1],
    [0, 0.8],
  ])
    expect(() =>
      parseAnalysisResult({
        ...base,
        harmony: [{ ...base.harmony[0], start, end }],
      }),
    ).toThrow()
  expect(() =>
    parseAnalysisResult({
      ...base,
      harmony: [base.harmony[0], base.harmony[0]],
    }),
  ).toThrow()
})
test('validates all extended identity evidence and alternatives rather than trusting labels', () => {
  const primary = {
    chord: { rootPc: 0, quality: 'dom7', bassPc: 4 },
    label: 'C7/E',
    evidence: { score: 0.8, margin: 0.2, level: 'medium' },
    supportedPitchClasses: [0, 4, 7, 10],
    missingPitchClasses: [],
  }
  const event = {
    start: 0,
    end: 1,
    kind: 'chord',
    bass: { midi: 52, pitchClass: 4, evidence: primary.evidence },
    primary,
    alternatives: [],
  }
  expect(
    parseAnalysisResult({ ...analysis(), harmony: [event] }).harmony[0],
  ).toEqual(event)
  for (const change of [
    { primary: { ...primary, evidence: { ...primary.evidence, score: 2 } } },
    { alternatives: [primary] },
    { alternatives: [primary, primary, primary, primary] },
    { bass: { ...event.bass, pitchClass: 5 } },
    { primary: { ...primary, chord: { ...primary.chord, quality: 'min9' } } },
  ])
    expect(() =>
      parseAnalysisResult({
        ...analysis(),
        harmony: [{ ...event, ...change }],
      }),
    ).toThrow()
})
test('bounds note arrays, cents and mode separation', () => {
  const note = {
    start: 0,
    end: 0.5,
    midi: 60,
    name: 'C4',
    cents: 0,
    evidence: { score: 0.8, margin: 0.2, level: 'medium' },
  }
  expect(() =>
    parseAnalysisResult({
      ...analysis(),
      monophonicNotes: Array(4001).fill(note),
    }),
  ).toThrow()
  expect(() =>
    parseAnalysisResult({
      ...analysis(),
      monophonicNotes: [{ ...note, cents: NaN }],
    }),
  ).toThrow()
  expect(() =>
    parseAnalysisResult({
      ...analysis(),
      options: { ...DEFAULT_OPTIONS, mode: 'polyphonic' },
      monophonicNotes: [note],
    }),
  ).toThrow()
})
test('features reject malformed chroma, ordering, excessive frames and unknown versions', () => {
  const frame = {
    time: 0.04,
    chroma: [1, ...Array<number>(11).fill(0)],
    midi: null,
    rms: 0.1,
  }
  const features = {
    schemaVersion: 1,
    engineVersion: 'rust-dsp-1',
    duration: 1,
    hopSeconds: 0.08,
    frames: [frame],
  }
  expect(parseAlignmentFeatures(features).frames[0].chroma).toHaveLength(12)
  for (const frames of [
    [{ ...frame, chroma: [1] }],
    [{ ...frame, chroma: Array<number>(12).fill(1) }],
    [frame, frame],
    Array(7501).fill(frame),
  ])
    expect(() => parseAlignmentFeatures({ ...features, frames })).toThrow()
})
test('features retain original-amplitude RMS for clipped float audio', () => {
  const features = {
    schemaVersion: 1,
    engineVersion: 'rust-dsp-3.1',
    duration: 1,
    hopSeconds: 0.08,
    frames: [
      { time: 0.04, chroma: Array<number>(12).fill(0), midi: null, rms: 2 },
    ],
  }
  expect(parseAlignmentFeatures(features).frames[0].rms).toBe(2)
  for (const rms of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() =>
      parseAlignmentFeatures({
        ...features,
        frames: [{ ...features.frames[0], rms }],
      }),
    ).toThrow()
  }
})
test('source, UUID, UTC expiry and hash are checked', () => {
  expect(() =>
    parseSource({
      kind: 'upload',
      name: '../display.wav',
      byteLength: 1,
      contentType: '',
    }),
  ).not.toThrow()
  expect(() => parseSource({ kind: 'youtube', videoId: '../../etc' })).toThrow()
  expect(() =>
    parseSource({
      kind: 'upload',
      name: 'bad\nname',
      byteLength: 1,
      contentType: '',
    }),
  ).toThrow()
  expect(() =>
    parseResultEnvelope({
      schemaVersion: 1,
      jobId: 'not-a-uuid',
      source: { kind: 'youtube', videoId: 'testaudio01' },
      title: null,
      pcmSha256: 'x'.repeat(64),
      analysis: analysis(),
    }),
  ).toThrow()
  const job = {
    schemaVersion: 1,
    id: '00000000-0000-4000-8000-000000000001',
    source: { kind: 'youtube', videoId: 'testaudio01' },
    options: DEFAULT_OPTIONS,
    createdAt: '2026-10-31T12:00:00Z',
    expiresAt: '2026-10-31T12:30:00Z',
    status: 'queued',
    progress: { stage: 'queued', fraction: null },
    error: null,
  }
  expect(parseJob(job)).toEqual(job)
  expect(() =>
    parseJob({ ...job, progress: { stage: 'queued', fraction: '0' } }),
  ).toThrow()
})
