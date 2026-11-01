/** Additive server song-job contract; the portable recognizer wire types stay pinned. */
import {
  choice,
  number,
  object,
  parseHash,
  string,
  parseJob as parseBaseJob,
  parseCapabilities as parseBaseCapabilities,
  parseResultEnvelope as parseBaseResult,
  type Job as BaseJob,
} from './analysisV1'
export type Focus = 'guitar' | 'full_mix'
export type Separator = {
  model: 'htdemucs_6s'
  weightsSha256: string
  package: string
  runtime: string
  shifts: 0
  overlap: 0.25
}
export type AnalyzedAudio =
  | { kind: 'full_mix'; pcmSha256: string }
  | {
      kind: 'guitar_stem'
      pcmSha256: string
      separator: Separator
      guitarLevelDb: number
    }
export type Job = Omit<BaseJob, 'status'> & {
  focus: Focus
  status: BaseJob['status'] | 'separating'
}
export type ResultEnvelope = ReturnType<typeof parseResultEnvelope>
export function parseSeparator(value: unknown): Separator {
  const v = object(value)
  return {
    model: choice(v.model, ['htdemucs_6s']),
    weightsSha256: parseHash(v.weightsSha256),
    package: string(v.package, 100),
    runtime: string(v.runtime, 100),
    shifts: choice(v.shifts, [0]),
    overlap: choice(v.overlap, [0.25]),
  }
}
export function parseAnalyzedAudio(
  value: unknown,
  originalHash: string,
): AnalyzedAudio {
  const v = object(value)
  const kind = choice(v.kind, ['full_mix', 'guitar_stem'])
  const pcmSha256 = parseHash(v.pcmSha256)
  if (kind === 'full_mix') {
    if (pcmSha256 !== originalHash)
      throw new Error('Full-mix analysis identity does not match playback.')
    return { kind, pcmSha256 }
  }
  if (pcmSha256 === originalHash)
    throw new Error('Isolated guitar identity matches the full mix.')
  return {
    kind,
    pcmSha256,
    separator: parseSeparator(v.separator),
    guitarLevelDb: number(v.guitarLevelDb, -120, 20),
  }
}
export function parseJob(value: unknown): Job {
  const v = object(value)
  const base = parseBaseJob(
    v.status === 'separating' ? { ...v, status: 'analyzing' } : v,
  )
  return {
    ...base,
    focus: choice(v.focus ?? 'full_mix', ['guitar', 'full_mix']),
    status: v.status === 'separating' ? 'separating' : base.status,
  }
}
export function parseCapabilities(value: unknown) {
  const v = object(value)
  const s =
    v.separation === undefined
      ? {
          available: false,
          reason: 'This server does not provide guitar separation.',
          separator: null,
        }
      : object(v.separation)
  if (typeof s.available !== 'boolean')
    throw new Error('Invalid separator availability.')
  const separator = s.separator === null ? null : parseSeparator(s.separator)
  const reason = s.reason === null ? null : string(s.reason, 2000)
  if (s.available !== (separator !== null) || (s.available && reason !== null))
    throw new Error('Invalid separator capability.')
  return {
    ...parseBaseCapabilities(value),
    separation: { available: s.available, reason, separator },
  }
}
export function parseResultEnvelope(value: unknown) {
  const v = object(value)
  const base = parseBaseResult(value)
  const focus = choice(v.focus, ['guitar', 'full_mix'])
  const analyzedAudio = parseAnalyzedAudio(v.analyzedAudio, base.pcmSha256)
  if ((focus === 'guitar') !== (analyzedAudio.kind === 'guitar_stem'))
    throw new Error('Analysis focus and source disagree.')
  return { ...base, focus, analyzedAudio }
}
export function verifyFocus(
  result: Pick<ResultEnvelope, 'focus' | 'analyzedAudio'>,
  focus: Focus,
  separator: Separator | null,
) {
  if (
    result.focus !== focus ||
    (focus === 'guitar' &&
      (result.analyzedAudio.kind !== 'guitar_stem' ||
        JSON.stringify(result.analyzedAudio.separator) !==
          JSON.stringify(separator)))
  )
    throw new Error(
      'The server returned a different analysis focus or separator.',
    )
}
export function analyzedSourceLabel(audio?: AnalyzedAudio) {
  return audio?.kind === 'guitar_stem'
    ? `Chords found in: isolated guitar (${audio.separator.model})`
    : audio
      ? 'Chords found in: full mix'
      : 'Full mix (earlier analysis)'
}
