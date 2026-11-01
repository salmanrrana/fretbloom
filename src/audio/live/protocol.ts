import type {
  AnalysisOptions,
  AnalysisResult,
  AlignmentFeatures,
} from '../analysisV1'

export type Key = { sessionId: string; generation: number }
export type GapReason =
  | 'paused'
  | 'muted'
  | 'context_suspended'
  | 'transport_overflow'
  | 'device_changed'
  | 'background_interruption'
export type CaptureBlock = Key & {
  type: 'pcm'
  sequence: number
  firstFrame: number
  frameCount: number
  sampleRateHz: number
  channels: 1 | 2
  interleaved: ArrayBuffer
}
export type CaptureMessage =
  | CaptureBlock
  | (Key & {
      type: 'boundary'
      sequence: number
      frame: number
      action: 'pause' | 'resume' | 'end'
      reason: GapReason | 'user_stop'
    })
export type CaptureReply =
  | (Key & {
      type: 'credit'
      sequence: number
      recycled: ArrayBuffer
    })
  | (Key & {
      type: 'boundary_ack'
      sequence: number
      action: 'pause' | 'resume' | 'end'
    })
// Child identity is independent of the session generation; request IDs never reset.
export type InputFence = Key & {
  childId: number
  requestId: number
  throughRequestId: number
}
export type InputReleased = InputFence & { type: 'input_released' }

export type EngineRequest = Key & {
  type: 'analyze'
  requestId: number
  purpose: 'live' | 'refine'
  segmentId: number
  startSample: number
  pcm: ArrayBuffer
  options: AnalysisOptions
}
export type EngineReply = Key & { requestId: number } & (
    | {
        type: 'result'
        result: AnalysisResult
        features: AlignmentFeatures
        computeMs: number
        wasmBytes: number
      }
    | { type: 'error'; code: LiveErrorCode; message: string }
  )
export type LiveErrorCode =
  | 'INVALID_INPUT'
  | 'LIMIT_EXCEEDED'
  | 'CANCELED'
  | 'SERIALIZATION_FAILED'
  | 'ENGINE_CRASH'
  | 'WASM_LOAD_FAILED'
  | 'PROTOCOL_MISMATCH'
  | 'ANALYSIS_TOO_SLOW'
  | 'CAPTURE_OVERFLOW'
  | 'UNSUPPORTED_SAMPLE_RATE'

export type TimelinePatch = Key & {
  revision: number
  segmentId: number
  missedLiveIntervals?: MissedLiveInterval[]
  replaceFromSample: number
  replaceToSample: number
  settledThroughSample: number
  // Starts/ends translated into session capture seconds, clipped to replacement.
  harmony: AnalysisResult['harmony']
  monophonicNotes: LiveNoteEvent[]
  polyphonicNotes: LiveNoteEvent[]
  warnings: AnalysisResult['warnings']
}
export type CaptureSegment = {
  id: number
  startSample: number
  endSample: number
  sourceRateHz: number
  channel: 'mean' | 'left' | 'right'
  precedingGap: null | { reason: GapReason; wallDurationMs: number | null }
}
export type LocalAnalysis = {
  schemaVersion: 1
  engineVersion: string
  options: AnalysisOptions
  durationSamples: number
  segments: CaptureSegment[]
  missedLiveIntervals?: MissedLiveInterval[]
  // Offsets are in capture time; result/features remain relative to this segment.
  results: {
    segmentId: number
    offsetSample: number
    result: AnalysisResult
    features: AlignmentFeatures
  }[]
  completeness: 'live' | 'partial' | 'refined'
}
export type RuntimeEvent =
  | { type: 'ready'; key: Key; engineVersion: string }
  | { type: 'timeline'; patch: TimelinePatch }
  | {
      type: 'status'
      key: Key
      // Authoritative nonempty active ingest segment and its current canonical sample.
      captureEpoch?: number
      capturePosition?: { segmentId: number; sample: number }
      capturedSamples: number
      analyzedThroughSample: number
      queuedBlocks: number
      processingMs: number
      wasmBytes: number
      ownedJsBytes?: number
      sharedPcmBytes?: number
      queuedHighWater?: number
      skippedWindows?: number
    }
  | { type: 'stopped'; key: Key; analysis: LocalAnalysis }
  | { type: 'refined'; key: Key; analysis: LocalAnalysis }
  | { type: 'error'; key: Key; code: LiveErrorCode; message: string }

export interface LiveRuntime {
  prepare(key: Key, options: AnalysisOptions): Promise<void>
  restore(
    key: Key,
    saved: LocalAnalysis,
    pcm: Blob,
    pcmSha256: string,
    signal: AbortSignal,
    options?: { allowEngineChange: true },
  ): Promise<void>
  attachCapturePort(
    port: MessagePort,
    options?: { channel: 'mean' | 'left' | 'right' },
  ): void
  stop(): Promise<LocalAnalysis>
  refine(signal: AbortSignal): Promise<LocalAnalysis>
  retryRetainedRefinement(signal: AbortSignal): Promise<LocalAnalysis>
  exportPcm(signal: AbortSignal): Promise<{
    pcm: Blob
    pcmSha256: string // mono f32le, not a WAV header
  }>
  cancelRefinement(): void
  dispose(): void
}

export const LIMITS = {
  sampleRate: 24000,
  samples: 7_200_000,
  segments: 64,
  notes: 4000,
  harmony: 3000,
  metadataBytes: 2 * 1024 * 1024,
  jsBytes: 96 * 1024 * 1024,
  wasmBytes: 128 * 1024 * 1024,
  first: 30720,
  hop: 15360,
  window: 61440,
  future: 7680,
  warmup: 15360,
  ring: 245760,
  short: 15360,
} as const

export type MissedLiveInterval = {
  segmentId: number
  startSample: number
  endSample: number
}
export type LiveNoteEvent = AnalysisResult['monophonicNotes'][number] & {
  id?: string
}
