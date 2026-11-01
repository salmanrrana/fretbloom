import {
  array,
  choice,
  number,
  object,
  parseAlignmentFeatures,
  parseAnalysisResult,
  parseJobId,
  parseOptions,
  string,
} from '../analysisV1'
import type { AnalysisOptions } from '../analysisV1'
import { LIMITS } from './protocol'
import type {
  CaptureMessage,
  EngineReply,
  EngineRequest,
  Key,
  LiveErrorCode,
  LocalAnalysis,
} from './protocol'
export function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  return number(value, 0, max, true)
}
export function parseKey(value: unknown): Key {
  const v = object(value)
  return {
    sessionId: parseJobId(v.sessionId),
    generation: integer(v.generation),
  }
}
export function sameKey(a: Key, b: Key): boolean {
  return a.sessionId === b.sessionId && a.generation === b.generation
}
export function buffer(value: unknown, max = LIMITS.samples * 4): ArrayBuffer {
  if (
    !(value instanceof ArrayBuffer) ||
    value.byteLength > max ||
    value.byteLength % 4
  )
    throw new Error('Invalid PCM buffer')
  return value
}
export function finitePcm(pcm: Float32Array): void {
  for (const sample of pcm)
    if (!Number.isFinite(sample)) throw new Error('Nonfinite PCM')
}
export const gapReasons = [
  'paused',
  'muted',
  'context_suspended',
  'transport_overflow',
  'device_changed',
  'background_interruption',
] as const
export const errorCodes = [
  'INVALID_INPUT',
  'LIMIT_EXCEEDED',
  'CANCELED',
  'SERIALIZATION_FAILED',
  'ENGINE_CRASH',
  'WASM_LOAD_FAILED',
  'PROTOCOL_MISMATCH',
  'ANALYSIS_TOO_SLOW',
  'CAPTURE_OVERFLOW',
  'UNSUPPORTED_SAMPLE_RATE',
] as const
export function parseCode(value: unknown): LiveErrorCode {
  return choice(value, errorCodes)
}
export function optionsEqual(a: AnalysisOptions, b: AnalysisOptions): boolean {
  return (
    a.mode === b.mode &&
    a.concertAHz === b.concertAHz &&
    a.spelling === b.spelling
  )
}
export function parseCaptureMessage(value: unknown): CaptureMessage {
  const v = object(value),
    key = parseKey(v),
    sequence = integer(v.sequence)
  if (v.type === 'boundary')
    return {
      ...key,
      type: 'boundary',
      sequence,
      frame: integer(v.frame),
      action: choice(v.action, ['pause', 'resume', 'end']),
      reason: choice(v.reason, [...gapReasons, 'user_stop']),
    }
  choice(v.type, ['pcm'])
  const channels = choice(v.channels, [1, 2]),
    frameCount = integer(v.frameCount, 2048),
    interleaved = buffer(v.interleaved, 2048 * 2 * 4)
  if (frameCount === 0 || interleaved.byteLength !== frameCount * channels * 4)
    throw new Error('Invalid capture block byte length')
  const sampleRateHz = number(v.sampleRateHz, 8000, 96000, true)
  finitePcm(new Float32Array(interleaved, 0, frameCount * channels))
  return {
    ...key,
    type: 'pcm',
    sequence,
    firstFrame: integer(v.firstFrame, Number.MAX_SAFE_INTEGER - frameCount),
    frameCount,
    sampleRateHz,
    channels,
    interleaved,
  }
}
export function parseEngineRequest(value: unknown): EngineRequest {
  const v = object(value),
    pcm = buffer(v.pcm)
  if (!pcm.byteLength) throw new Error('Empty analysis')
  return {
    ...parseKey(v),
    type: choice(v.type, ['analyze']),
    requestId: integer(v.requestId),
    purpose: choice(v.purpose, ['live', 'refine']),
    segmentId: integer(v.segmentId, 63),
    startSample: integer(v.startSample, LIMITS.samples - pcm.byteLength / 4),
    pcm,
    options: parseOptions(v.options),
  }
}
export function parseOutput(
  value: unknown,
  expectedSamples?: number,
  engineVersion?: string,
) {
  const v = object(value),
    result = parseAnalysisResult(v.result),
    features = parseAlignmentFeatures(v.features)
  if (
    result.engineVersion !== features.engineVersion ||
    Math.abs(result.duration - features.duration) > 1e-8 ||
    (expectedSamples !== undefined &&
      Math.abs(result.duration - expectedSamples / 24000) > 1e-8) ||
    (engineVersion !== undefined && result.engineVersion !== engineVersion)
  )
    throw new Error('Engine result association mismatch')
  return { result, features }
}
export function parseEngineReply(value: unknown): EngineReply {
  const v = object(value),
    base = { ...parseKey(v), requestId: integer(v.requestId) }
  if (v.type === 'error')
    return {
      ...base,
      type: 'error',
      code: parseCode(v.code),
      message: string(v.message, 1000),
    }
  return {
    ...base,
    type: choice(v.type, ['result']),
    ...parseOutput(v),
    computeMs: number(v.computeMs, 0, 120_000),
    wasmBytes: integer(v.wasmBytes, LIMITS.wasmBytes),
  }
}
/** Saved metadata is readable across engine upgrades; refinement checks the active engine separately. */
export function parseLocalAnalysis(value: unknown): LocalAnalysis {
  if (
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
    LIMITS.metadataBytes
  )
    throw new Error('Local metadata exceeds 2 MiB')
  const v = object(value),
    options = parseOptions(v.options),
    engineVersion = string(v.engineVersion, 100),
    durationSamples = integer(v.durationSamples, LIMITS.samples)
  const segments = array(v.segments, LIMITS.segments, (value) => {
    const s = object(value),
      gap = s.precedingGap === null ? null : object(s.precedingGap)
    return {
      id: integer(s.id, 63),
      startSample: integer(s.startSample, LIMITS.samples),
      endSample: integer(s.endSample, LIMITS.samples),
      sourceRateHz: number(s.sourceRateHz, 8000, 96000, true),
      channel: choice(s.channel, ['mean', 'left', 'right']),
      precedingGap:
        gap === null
          ? null
          : {
              reason: choice(gap.reason, gapReasons),
              wallDurationMs:
                gap.wallDurationMs === null
                  ? null
                  : number(gap.wallDurationMs, 0, 1_800_000),
            },
    }
  })
  let end = 0
  const ids = new Set<number>()
  for (const s of segments) {
    if (
      ids.has(s.id) ||
      s.startSample !== end ||
      s.endSample <= s.startSample ||
      (ids.size === 0 && s.precedingGap !== null) ||
      (ids.size > 0 && s.precedingGap === null)
    )
      throw new Error('Invalid contiguous segment extents/gaps')
    ids.add(s.id)
    end = s.endSample
  }
  if (end !== durationSamples) throw new Error('PCM extent mismatch')
  const resultIds = new Set<number>()
  let mono = 0,
    poly = 0,
    harmony = 0
  const results = array(v.results, LIMITS.segments, (value) => {
    const r = object(value),
      segmentId = integer(r.segmentId, 63),
      offsetSample = integer(r.offsetSample, LIMITS.samples),
      output = parseOutput(r),
      segment = segments.find((s) => s.id === segmentId)
    if (
      !segment ||
      resultIds.has(segmentId) ||
      offsetSample !== segment.startSample ||
      Math.abs(
        output.result.duration -
          (segment.endSample - segment.startSample) / 24000,
      ) > 1e-8 ||
      output.result.engineVersion !== engineVersion ||
      !optionsEqual(output.result.options, options)
    )
      throw new Error('Invalid local result association')
    // Each independent segment owns its final partial 80 ms frame. The duration
    // and 64-segment limits bound the total to 3,813, without dropping gap edges.
    const maxFrames = Math.ceil(
      (segment.endSample - segment.startSample) /
        (LIMITS.sampleRate * output.features.hopSeconds),
    )
    if (output.features.frames.length > maxFrames)
      throw new Error('Local alignment frame cadence exceeded')
    resultIds.add(segmentId)
    mono += output.result.monophonicNotes.length
    poly += output.result.polyphonicNotes.length
    harmony += output.result.harmony.length
    return { segmentId, offsetSample, ...output }
  })
  if (mono > LIMITS.notes || poly > LIMITS.notes || harmony > LIMITS.harmony)
    throw new Error('Local event cap exceeded')
  const completeness = choice(v.completeness, ['live', 'partial', 'refined'])
  if (
    completeness === 'refined' &&
    segments.some(
      (s) => s.endSample - s.startSample < LIMITS.short || !resultIds.has(s.id),
    )
  )
    throw new Error('Refined session has incomplete segments')
  return {
    schemaVersion: choice(v.schemaVersion, [1]),
    engineVersion,
    options,
    durationSamples,
    segments,
    results,
    ...(v.missedLiveIntervals === undefined
      ? {}
      : {
          missedLiveIntervals: parseMissedIntervals(
            v.missedLiveIntervals,
            segments,
          ),
        }),
    completeness,
  }
}

export function parseMissedIntervals(
  value: unknown,
  segments: LocalAnalysis['segments'],
) {
  const intervals = array(value, 1024, (value) => {
    const v = object(value),
      segmentId = integer(v.segmentId, 63),
      startSample = integer(v.startSample, LIMITS.samples),
      endSample = integer(v.endSample, LIMITS.samples)
    const segment = segments.find((s) => s.id === segmentId)
    if (
      !segment ||
      startSample < segment.startSample ||
      endSample > segment.endSample ||
      endSample <= startSample
    )
      throw new Error('Invalid missed live interval')
    return { segmentId, startSample, endSample }
  })
  for (let i = 1; i < intervals.length; i++)
    if (
      intervals[i].startSample < intervals[i - 1].endSample ||
      (intervals[i].segmentId === intervals[i - 1].segmentId &&
        intervals[i].startSample === intervals[i - 1].endSample)
    )
      throw new Error('Unsorted or uncoalesced missed intervals')
  return intervals
}

/** Release fences carry metadata only, with an exact accepted-request watermark. */
export function parseInputFence(value: unknown) {
  const v = object(value)
  const requestId = integer(v.requestId)
  const throughRequestId = integer(v.throughRequestId)
  if (requestId !== throughRequestId) throw new Error('Invalid input watermark')
  return {
    ...parseKey(v),
    childId: integer(v.childId),
    requestId,
    throughRequestId,
  }
}
