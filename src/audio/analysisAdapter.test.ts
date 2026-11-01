import { expect, test } from 'vitest'
import {
  adaptAnalysis,
  alignRichAnalysis,
  analysisProjection,
  sameRecording,
} from './analysisAdapter'
import {
  DEFAULT_OPTIONS,
  type AnalysisResult,
  type AlignmentFeatures,
  type ResultEnvelope,
} from './analysisV1'
import { parseTab } from '../data/tabParser'
const evidence = { score: 0.9, margin: 0.3, level: 'high' as const }
function analysis(): AnalysisResult {
  return {
    schemaVersion: 1,
    engineVersion: 'rust-dsp-1',
    options: DEFAULT_OPTIONS,
    duration: 4,
    sampleRateHz: 24000,
    timingResolutionSeconds: 0.02,
    tuning: { referenceHz: 440, estimatedOffsetCents: null },
    harmony: [
      {
        kind: 'chord',
        start: 0,
        end: 1,
        bass: null,
        primary: {
          chord: { rootPc: 0, quality: 'dom7', bassPc: null },
          label: 'C7',
          evidence,
          supportedPitchClasses: [0, 4, 7, 10],
          missingPitchClasses: [],
        },
        alternatives: [],
      },
      {
        kind: 'unknown',
        start: 1,
        end: 2,
        bass: null,
        reason: 'ambiguous',
        alternatives: [],
      },
      { kind: 'no_chord', start: 2, end: 4, bass: null, reason: 'silence' },
    ],
    monophonicNotes: [
      { start: 0, end: 1, midi: 60, name: 'C4', cents: 1, evidence },
    ],
    polyphonicNotes: [
      { start: 0, end: 1, midi: 64, name: 'E4', cents: 0, evidence },
    ],
    warnings: [],
  }
}
function envelope(): ResultEnvelope {
  return {
    schemaVersion: 1,
    jobId: '00000000-0000-4000-8000-000000000001',
    source: {
      kind: 'upload',
      name: 'a.wav',
      byteLength: 44,
      contentType: 'audio/wav',
    },
    title: null,
    pcmSha256: 'a'.repeat(64),
    analysis: analysis(),
  }
}
test('projection keeps full chord labels, gaps and only the monophonic legacy notes', () => {
  const projected = analysisProjection(analysis())
  expect(projected.chords.map((e) => e.label)).toEqual(['C7', 'N', 'N'])
  expect(projected.notes.map((n) => n.midi)).toEqual([60])
})
test('the adapter refuses mismatched engines and durations', () => {
  const features: AlignmentFeatures = {
    schemaVersion: 1,
    engineVersion: 'rust-dsp-1',
    duration: 4,
    hopSeconds: 0.08,
    frames: [],
  }
  expect(adaptAnalysis(envelope(), features).duration).toBe(4)
  expect(() => adaptAnalysis(envelope(), { ...features, duration: 5 })).toThrow(
    'timeline',
  )
  expect(() =>
    adaptAnalysis(envelope(), { ...features, engineVersion: 'older' }),
  ).toThrow('engine')
})
test('reattachment timing requires decoded hash and duration, not file metadata', () => {
  const original = envelope()
  expect(
    sameRecording(original, { ...original, pcmSha256: 'b'.repeat(64) }),
  ).toBe(false)
  expect(
    sameRecording(original, {
      ...original,
      analysis: { ...original.analysis, duration: 5 },
    }),
  ).toBe(false)
  expect(
    sameRecording(original, {
      ...original,
      source: {
        kind: 'upload',
        name: 'renamed.flac',
        byteLength: 90,
        contentType: 'audio/flac',
      },
    }),
  ).toBe(true)
})
test('extended and slash alignment requires rich characteristic-tone and bass evidence', () => {
  const result = envelope()
  const pcs = [0, 4, 7, 10]
  const chroma = Array.from({ length: 12 }, (_, pc) =>
    pcs.includes(pc) ? 0.5 : 0,
  )
  const features: AlignmentFeatures = {
    schemaVersion: 1,
    engineVersion: 'rust-dsp-1',
    duration: 4,
    hopSeconds: 0.08,
    frames: Array.from({ length: 50 }, (_, i) => ({
      time: i * 0.08 + 0.04,
      chroma,
      midi: null,
      rms: 0.1,
    })),
  }
  const steps = parseTab('C7/E').steps
  const aligned = alignRichAnalysis(result, features, steps)
  expect(aligned.reliable).toBe(false)
  expect(aligned.reason).toMatch(/bass|tones/)
  result.analysis.harmony = [
    {
      kind: 'chord',
      start: 0,
      end: 4,
      bass: { midi: 52, pitchClass: 4, evidence },
      primary: {
        chord: { rootPc: 0, quality: 'dom7', bassPc: 4 },
        label: 'C7/E',
        evidence,
        supportedPitchClasses: pcs,
        missingPitchClasses: [],
      },
      alternatives: [],
    },
  ]
  expect(alignRichAnalysis(result, features, steps).reliable).toBe(true)
})
