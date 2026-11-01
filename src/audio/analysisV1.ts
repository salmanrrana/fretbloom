/** Strict v1 boundary. Extra fields are ignored; values are never coerced. */
export const QUALITIES = [
  'maj',
  'min',
  'dom7',
  'maj7',
  'min7',
  'sus2',
  'sus4',
  'add9',
  'madd9',
  'add11',
  'madd11',
  '6',
  'm6',
  'dim',
  'dim7',
  'hdim7',
  'aug',
  '5',
] as const
export const MODES = ['auto', 'monophonic', 'polyphonic'] as const
export type AnalysisMode = (typeof MODES)[number]
export type ChordQuality = (typeof QUALITIES)[number]
export type Spelling = 'sharps' | 'flats'
export type AnalysisOptions = {
  mode: AnalysisMode
  concertAHz: number
  spelling: Spelling
}
export const DEFAULT_OPTIONS: AnalysisOptions = {
  mode: 'auto',
  concertAHz: 440,
  spelling: 'sharps',
}
export type Source =
  | { kind: 'youtube'; videoId: string }
  | { kind: 'upload'; name: string; byteLength: number; contentType: string }
export type CreateJob = { source: Source; options?: Partial<AnalysisOptions> }
export type ApiError = { code: string; message: string; retryable: boolean }
export type Evidence = {
  score: number
  margin: number
  level: 'low' | 'medium' | 'high'
}
export type ChordIdentity = {
  rootPc: number
  quality: ChordQuality
  bassPc: number | null
}
export type ChordCandidate = {
  chord: ChordIdentity
  label: string
  evidence: Evidence
  supportedPitchClasses: number[]
  missingPitchClasses: number[]
}
export type BassEstimate = {
  midi: number
  pitchClass: number
  evidence: Evidence
}
export type HarmonyEvent = {
  start: number
  end: number
  bass: BassEstimate | null
} & (
  | { kind: 'chord'; primary: ChordCandidate; alternatives: ChordCandidate[] }
  | { kind: 'no_chord'; reason: 'silence' | 'unpitched' | 'single_note' }
  | {
      kind: 'unknown'
      reason: 'ambiguous' | 'insufficient_evidence'
      alternatives: ChordCandidate[]
    }
)
export type NoteEvent = {
  start: number
  end: number
  midi: number
  name: string
  cents: number
  evidence: Evidence
}
export type AnalysisWarning = {
  code:
    | 'clipping'
    | 'low_signal'
    | 'dense_polyphony'
    | 'tuning_uncertain'
    | 'channel_cancellation'
    | 'limited_bandwidth'
  message: string
}
export type AnalysisResult = {
  schemaVersion: 1
  engineVersion: string
  options: AnalysisOptions
  duration: number
  sampleRateHz: 24000
  timingResolutionSeconds: number
  tuning: { referenceHz: number; estimatedOffsetCents: number | null }
  harmony: HarmonyEvent[]
  monophonicNotes: NoteEvent[]
  polyphonicNotes: NoteEvent[]
  warnings: AnalysisWarning[]
}
export type ResultEnvelope = {
  schemaVersion: 1
  jobId: string
  source: Source
  title: string | null
  pcmSha256: string
  analysis: AnalysisResult
}
export type AlignmentFeatures = {
  schemaVersion: 1
  engineVersion: string
  duration: number
  hopSeconds: number
  frames: { time: number; chroma: number[]; midi: number | null; rms: number }[]
}
export type Job = {
  schemaVersion: 1
  id: string
  source: Source
  options: AnalysisOptions
  createdAt: string
  expiresAt: string
  status:
    | 'awaiting_upload'
    | 'queued'
    | 'fetching'
    | 'decoding'
    | 'analyzing'
    | 'succeeded'
    | 'failed'
    | 'canceled'
  progress: { stage: string; fraction: number | null }
  error: ApiError | null
}
export const MAX_SOURCE_BYTES = 50 * 1024 * 1024
export const MAX_AUDIO_BYTES = 30 * 1024 * 1024
export class AnalysisValidationError extends Error {
  constructor(field: string) {
    super(`Invalid analysis response: ${field}.`)
  }
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
export function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new AnalysisValidationError('object')
  return value
}
export function number(
  value: unknown,
  min: number,
  max: number,
  integer = false,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new AnalysisValidationError('number')
  return value
}
export function string(value: unknown, max = 500, min = 1): string {
  if (
    typeof value !== 'string' ||
    value.length < min ||
    value.length > max ||
    [...value].some((c) => {
      const code = c.charCodeAt(0)
      return code === 127 || (code < 32 && ![9, 10, 13].includes(code))
    })
  )
    throw new AnalysisValidationError('text')
  return value
}
export function choice<const T extends readonly (string | number)[]>(
  value: unknown,
  values: T,
): T[number] {
  for (const candidate of values) if (candidate === value) return candidate
  throw new AnalysisValidationError('enum')
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new AnalysisValidationError('boolean')
  return value
}
export function array<T>(
  value: unknown,
  max: number,
  parse: (v: unknown) => T,
): T[] {
  if (!Array.isArray(value) || value.length > max)
    throw new AnalysisValidationError('array size')
  const values: unknown[] = value
  return values.map(parse)
}
function nullable<T>(value: unknown, parse: (v: unknown) => T): T | null {
  return value === null ? null : parse(value)
}
export function parseHash(value: unknown): string {
  const hash = string(value, 64)
  if (!/^[a-f0-9]{64}$/.test(hash))
    throw new AnalysisValidationError('PCM hash')
  return hash
}
export function parseJobId(value: unknown): string {
  const id = string(value, 36)
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      id,
    )
  )
    throw new AnalysisValidationError('job ID')
  return id
}
export function parseSource(value: unknown): Source {
  const v = object(value)
  const kind = choice(v.kind, ['youtube', 'upload'])
  if (kind === 'youtube') {
    const videoId = string(v.videoId, 11)
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId))
      throw new AnalysisValidationError('video ID')
    return { kind, videoId }
  }
  const name = string(v.name, 200)
  if ([...name].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))
    throw new AnalysisValidationError('filename')
  return {
    kind,
    name,
    byteLength: number(v.byteLength, 1, MAX_SOURCE_BYTES, true),
    contentType: string(v.contentType, 200, 0),
  }
}
export function parseOptions(value: unknown): AnalysisOptions {
  const v = object(value)
  return {
    mode: choice(v.mode, MODES),
    concertAHz: number(v.concertAHz, 432, 446),
    spelling: choice(v.spelling, ['sharps', 'flats']),
  }
}
export function parseApiError(value: unknown): ApiError {
  const v = object(value)
  return {
    code: string(v.code, 100),
    message: string(v.message, 1000),
    retryable: bool(v.retryable),
  }
}
function iso(value: unknown): string {
  const v = string(value, 40)
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v) ||
    !Number.isFinite(Date.parse(v))
  )
    throw new AnalysisValidationError('UTC date')
  return v
}
export function parseJob(value: unknown): Job {
  const v = object(value),
    p = object(v.progress)
  const createdAt = iso(v.createdAt),
    expiresAt = iso(v.expiresAt)
  if (Date.parse(expiresAt) < Date.parse(createdAt))
    throw new AnalysisValidationError('expiry')
  return {
    schemaVersion: choice(v.schemaVersion, [1]),
    id: parseJobId(v.id),
    source: parseSource(v.source),
    options: parseOptions(v.options),
    createdAt,
    expiresAt,
    status: choice(v.status, [
      'awaiting_upload',
      'queued',
      'fetching',
      'decoding',
      'analyzing',
      'succeeded',
      'failed',
      'canceled',
    ]),
    progress: {
      stage: string(p.stage, 100),
      fraction: nullable(p.fraction, (n) => number(n, 0, 1)),
    },
    error: nullable(v.error, parseApiError),
  }
}
function evidence(value: unknown): Evidence {
  const v = object(value)
  return {
    score: number(v.score, 0, 1),
    margin: number(v.margin, 0, 1),
    level: choice(v.level, ['low', 'medium', 'high']),
  }
}
function pc(value: unknown): number {
  return number(value, 0, 11, true)
}
function candidate(value: unknown): ChordCandidate {
  const v = object(value),
    c = object(v.chord)
  const pcs = (value: unknown) => {
    const result = array(value, 12, pc)
    if (new Set(result).size !== result.length)
      throw new AnalysisValidationError('duplicate pitch classes')
    return result
  }
  return {
    chord: {
      rootPc: pc(c.rootPc),
      quality: choice(c.quality, QUALITIES),
      bassPc: nullable(c.bassPc, pc),
    },
    label: string(v.label, 100),
    evidence: evidence(v.evidence),
    supportedPitchClasses: pcs(v.supportedPitchClasses),
    missingPitchClasses: pcs(v.missingPitchClasses),
  }
}
function span(v: Record<string, unknown>, duration: number) {
  const start = number(v.start, 0, duration),
    end = number(v.end, 0, duration)
  if (start >= end) throw new AnalysisValidationError('interval')
  return { start, end }
}
function harmony(value: unknown, duration: number): HarmonyEvent {
  const v = object(value)
  const bass = nullable(v.bass, (value): BassEstimate => {
    const b = object(value),
      midi = number(b.midi, 0, 127, true),
      pitchClass = pc(b.pitchClass)
    if (midi % 12 !== pitchClass)
      throw new AnalysisValidationError('bass pitch class')
    return { midi, pitchClass, evidence: evidence(b.evidence) }
  })
  const base = { ...span(v, duration), bass }
  const kind = choice(v.kind, ['chord', 'no_chord', 'unknown'])
  if (kind === 'no_chord')
    return {
      ...base,
      kind,
      reason: choice(v.reason, ['silence', 'unpitched', 'single_note']),
    }
  const alternatives = array(v.alternatives, 3, candidate)
  const keys = alternatives.map((c) => JSON.stringify(c.chord))
  if (new Set(keys).size !== keys.length)
    throw new AnalysisValidationError('duplicate alternatives')
  if (kind === 'unknown')
    return {
      ...base,
      kind,
      alternatives,
      reason: choice(v.reason, ['ambiguous', 'insufficient_evidence']),
    }
  const primary = candidate(v.primary)
  if (keys.includes(JSON.stringify(primary.chord)))
    throw new AnalysisValidationError('duplicate primary')
  return { ...base, kind, primary, alternatives }
}
export function parseAnalysisResult(value: unknown): AnalysisResult {
  const v = object(value),
    t = object(v.tuning),
    duration = number(v.duration, 1 / 24000, 600)
  const events = array(v.harmony, 3000, (e) => harmony(e, duration))
  // Empty silent streams are allowed by v1; nonempty harmony must cover the timeline.
  let end = 0
  for (const event of events) {
    if (Math.abs(event.start - end) > 1e-6)
      throw new AnalysisValidationError('harmony coverage')
    end = event.end
  }
  if (events.length && Math.abs(end - duration) > 1e-6)
    throw new AnalysisValidationError('harmony duration')
  const notes = (value: unknown) =>
    array(value, 4000, (value): NoteEvent => {
      const n = object(value)
      return {
        ...span(n, duration),
        midi: number(n.midi, 0, 127, true),
        name: string(n.name, 20),
        cents: number(n.cents, -50, 50),
        evidence: evidence(n.evidence),
      }
    })
  const options = parseOptions(v.options)
  const monophonicNotes = notes(v.monophonicNotes),
    polyphonicNotes = notes(v.polyphonicNotes)
  if (
    (options.mode === 'monophonic' && polyphonicNotes.length) ||
    (options.mode === 'polyphonic' && monophonicNotes.length)
  )
    throw new AnalysisValidationError('mode note streams')
  return {
    schemaVersion: choice(v.schemaVersion, [1]),
    engineVersion: string(v.engineVersion, 100),
    options,
    duration,
    sampleRateHz: choice(v.sampleRateHz, [24000]),
    timingResolutionSeconds: choice(v.timingResolutionSeconds, [0.02]),
    tuning: {
      referenceHz: number(t.referenceHz, 432, 446),
      estimatedOffsetCents: nullable(t.estimatedOffsetCents, (n) =>
        number(n, -50, 50),
      ),
    },
    harmony: events,
    monophonicNotes,
    polyphonicNotes,
    warnings: array(v.warnings, 100, (value) => {
      const w = object(value)
      return {
        code: choice(w.code, [
          'clipping',
          'low_signal',
          'dense_polyphony',
          'tuning_uncertain',
          'channel_cancellation',
          'limited_bandwidth',
        ]),
        message: string(w.message, 1000),
      }
    }),
  }
}
export function parseResultEnvelope(value: unknown): ResultEnvelope {
  const v = object(value)
  return {
    schemaVersion: choice(v.schemaVersion, [1]),
    jobId: parseJobId(v.jobId),
    source: parseSource(v.source),
    title: nullable(v.title, (v) => string(v, 300)),
    pcmSha256: parseHash(v.pcmSha256),
    analysis: parseAnalysisResult(v.analysis),
  }
}
export function parseAlignmentFeatures(value: unknown): AlignmentFeatures {
  const v = object(value),
    duration = number(v.duration, 1 / 24000, 600)
  const frames = array(v.frames, 7500, (value) => {
    const f = object(value),
      chroma = array(f.chroma, 12, (v) => number(v, 0, 1))
    const norm = Math.hypot(...chroma)
    if (chroma.length !== 12 || (norm > 1e-6 && Math.abs(norm - 1) > 1e-4))
      throw new AnalysisValidationError('normalized chroma')
    return {
      time: number(f.time, 0, duration),
      chroma,
      midi: nullable(f.midi, (m) => number(m, 0, 127)),
      // Rust retains original-amplitude energy even when spectral input is clipped.
      rms: number(f.rms, 0, Number.MAX_VALUE),
    }
  })
  if (frames.some((f, i) => i > 0 && f.time <= frames[i - 1].time))
    throw new AnalysisValidationError('frame order')
  return {
    schemaVersion: choice(v.schemaVersion, [1]),
    engineVersion: string(v.engineVersion, 100),
    duration,
    hopSeconds: choice(v.hopSeconds, [0.08]),
    frames,
  }
}
export function parseCapabilities(value: unknown) {
  const v = object(value),
    l = object(v.limits)
  return {
    schemaVersion: choice(v.schemaVersion, [1]),
    engineVersion: string(v.engineVersion, 100),
    modes: array(v.modes, 3, (v) => choice(v, MODES)),
    qualities: array(v.qualities, 18, (v) => choice(v, QUALITIES)),
    limits: {
      maxSourceBytes: number(l.maxSourceBytes, 1, MAX_SOURCE_BYTES, true),
      maxDurationSeconds: number(l.maxDurationSeconds, 1, 600),
    },
    uploads: bool(v.uploads),
    youtube: bool(v.youtube),
  }
}
