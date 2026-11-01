import { describe, it, expect } from 'vitest'
import {
  parseLocalAnalysis,
  parseCaptureMessage,
  parseEngineReply,
} from './validation'
const key = { sessionId: '77dd02f6-1d87-4e24-97a0-411c91795a82', generation: 2 }
const saved = {
  schemaVersion: 1,
  engineVersion: 'older-readable-engine',
  options: { mode: 'auto', concertAHz: 440, spelling: 'sharps' },
  durationSamples: 24000,
  segments: [
    {
      id: 0,
      startSample: 0,
      endSample: 24000,
      sourceRateHz: 48000,
      channel: 'right',
      precedingGap: null,
    },
  ],
  results: [],
  completeness: 'partial',
  missedLiveIntervals: [{ segmentId: 0, startSample: 0, endSample: 24000 }],
}

function segmentedRecording(lengths: number[]) {
  let offset = 0
  const segments = lengths.map((length, id) => {
    const segment = {
      id,
      startSample: offset,
      endSample: offset + length,
      sourceRateHz: 24000,
      channel: 'mean',
      precedingGap: id === 0 ? null : { reason: 'paused', wallDurationMs: 10 },
    }
    offset += length
    return segment
  })
  return {
    ...saved,
    durationSamples: offset,
    segments,
    missedLiveIntervals: [],
    completeness: 'refined',
    results: segments.map((segment) => {
      const duration = (segment.endSample - segment.startSample) / 24000
      return {
        segmentId: segment.id,
        offsetSample: segment.startSample,
        result: {
          schemaVersion: 1,
          engineVersion: saved.engineVersion,
          options: saved.options,
          duration,
          sampleRateHz: 24000,
          timingResolutionSeconds: 0.02,
          tuning: { referenceHz: 440, estimatedOffsetCents: null },
          harmony: [
            {
              start: 0,
              end: duration,
              kind: 'no_chord',
              reason: 'silence',
              bass: null,
            },
          ],
          monophonicNotes: [],
          polyphonicNotes: [],
          warnings: [],
        },
        features: {
          schemaVersion: 1,
          engineVersion: saved.engineVersion,
          duration,
          hopSeconds: 0.08,
          frames: Array.from(
            {
              length: Math.ceil(
                (segment.endSample - segment.startSample) / 1920,
              ),
            },
            (_, i) => ({
              time: Math.min(
                Math.round((i * 0.08 + 0.04) * 1e6) / 1e6,
                duration,
              ),
              chroma: Array.from({ length: 12 }, () => 0),
              midi: null,
              rms: 0,
            }),
          ),
        },
      }
    }),
  }
}
describe('local runtime boundaries', () => {
  it('retains each segment edge frame in a full five-minute recording', () => {
    const value = segmentedRecording([16384, 7200000 - 16384])
    expect(value.results.map((r) => r.features.frames.length)).toEqual([
      9, 3742,
    ])
    expect(parseLocalAnalysis(value)).toEqual(value)
  })
  it('bounds all 64 segment tails by their own duration and cadence', () => {
    const lengths = [
      ...Array.from({ length: 63 }, () => 15361),
      7200000 - 63 * 15361,
    ]
    const value = segmentedRecording(lengths)
    expect(
      value.results.reduce((sum, r) => sum + r.features.frames.length, 0),
    ).toBe(3813)
    expect(parseLocalAnalysis(value)).toEqual(value)

    const excessive = segmentedRecording([16384])
    const features = excessive.results[0].features
    const last = features.frames.at(-1)
    if (!last) throw new Error('Expected nonempty alignment features')
    features.frames.push({ ...last, time: features.duration })
    expect(() => parseLocalAnalysis(excessive)).toThrow(/cadence/)
  })
  it('preserves old engine metadata/diagnostics and rejects malformed extents/caps', () => {
    expect(parseLocalAnalysis(saved)).toEqual(saved)
    for (const value of [
      { ...saved, durationSamples: 23999 },
      { ...saved, segments: [{ ...saved.segments[0], startSample: 1 }] },
      {
        ...saved,
        missedLiveIntervals: [{ segmentId: 1, startSample: 0, endSample: 3 }],
      },
      {
        ...saved,
        missedLiveIntervals: [
          { segmentId: 0, startSample: 0, endSample: 24001 },
        ],
      },
      {
        ...saved,
        missedLiveIntervals: [{ segmentId: 0, startSample: 2, endSample: 2 }],
      },
      { ...saved, options: { mode: 'all-notes' } },
    ])
      expect(() => parseLocalAnalysis(value)).toThrow()
  })
  it('checks raw transport lengths, keys, finite samples and safe clocks', () => {
    const capture = {
      ...key,
      type: 'pcm',
      sequence: 0,
      firstFrame: 0,
      frameCount: 3,
      sampleRateHz: 44100,
      channels: 2,
      interleaved: new Float32Array(6).buffer,
    }
    expect(parseCaptureMessage(capture)).toEqual(capture)
    for (const value of [
      { ...capture, frameCount: 4 },
      { ...capture, firstFrame: 2 ** 54 },
      { ...capture, sessionId: 'nope' },
      { ...capture, sampleRateHz: 96001 },
      {
        ...capture,
        interleaved: new Float32Array([NaN, 0, 0, 0, 0, 0]).buffer,
      },
    ])
      expect(() => parseCaptureMessage(value)).toThrow()
    expect(() =>
      parseEngineReply({
        ...key,
        type: 'error',
        requestId: 1,
        code: 'made-up',
        message: 'no',
      }),
    ).toThrow()
  })
})
