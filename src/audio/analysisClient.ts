import {
  parseCapabilities,
  parseJob,
  parseResultEnvelope,
  verifyFocus,
  type Focus,
  type Job,
} from './songJob'
import {
  DEFAULT_OPTIONS,
  MAX_AUDIO_BYTES,
  MAX_SOURCE_BYTES,
  parseAlignmentFeatures,
  parseApiError,
  parseJobId,
  parseOptions,
  parseSource,
  object,
  type AnalysisOptions,
  type ApiError,
  type CreateJob,
  type Source,
} from './analysisV1'

const PREFIX = '/api/analysis/v1'
export type ClientOptions = {
  signal: AbortSignal
  focus?: Focus
  onStatus: (job: Job) => void
}
export class AnalysisApiError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly status: number
  constructor(error: ApiError, status = 0) {
    super(error.message)
    this.status = status
    this.code = error.code
    this.retryable = error.retryable
  }
}
/** Read streaming bodies with a hard cap even when Content-Length is absent or false. */
export async function boundedBody(
  response: Response,
  max: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const length = response.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) {
    await response.body?.cancel()
    throw new Error('The analysis response is too large.')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The server returned an empty response.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > max) throw new Error('The analysis response is too large.')
      chunks.push(next.value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}
async function responseError(response: Response): Promise<never> {
  if (response.headers.get('content-type')?.includes('application/json')) {
    const value: unknown = JSON.parse(
      new TextDecoder().decode(await boundedBody(response, 16 * 1024)),
    )
    throw new AnalysisApiError(
      parseApiError(object(value).error),
      response.status,
    )
  }
  await response.body?.cancel()
  throw new AnalysisApiError(
    {
      code: 'BACKEND_UNAVAILABLE',
      message:
        'Full audio analysis is unavailable on this server. Start the full backend or try again later.',
      retryable: response.status >= 500,
    },
    response.status,
  )
}
async function json<T>(
  path: string,
  parse: (value: unknown) => T,
  signal: AbortSignal,
  init?: RequestInit,
  max = 16 * 1024,
): Promise<T> {
  const response = await fetch(`${PREFIX}${path}`, {
    ...init,
    signal,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json', ...init?.headers },
  })
  if (!response.ok) return responseError(response)
  if (!response.headers.get('content-type')?.includes('application/json')) {
    await response.body?.cancel()
    throw new Error(
      'Full audio analysis is unavailable on this server. No audio was analyzed.',
    )
  }
  const value: unknown = JSON.parse(
    new TextDecoder().decode(await boundedBody(response, max)),
  )
  return parse(value)
}
function jobPath(id: string) {
  return `/jobs/${parseJobId(id)}`
}
export function getAnalysisCapabilities(signal: AbortSignal) {
  return json('/capabilities', parseCapabilities, signal)
}
export function createAnalysisJob(
  input: CreateJob & { focus?: Focus },
  signal: AbortSignal,
) {
  const body = JSON.stringify({
    focus: input.focus ?? 'full_mix',
    source: parseSource(input.source),
    options: parseOptions({ ...DEFAULT_OPTIONS, ...input.options }),
  })
  if (new TextEncoder().encode(body).length > 16 * 1024)
    throw new Error('Analysis request is too large.')
  return json('/jobs', parseJob, signal, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}
export function uploadAnalysisMedia(
  id: string,
  file: File,
  signal: AbortSignal,
) {
  if (!file.size || file.size > MAX_SOURCE_BYTES)
    throw new Error('Choose a nonempty recording up to 50 MiB.')
  return json(`${jobPath(id)}/media`, parseJob, signal, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  })
}
export function getAnalysisJob(id: string, signal: AbortSignal) {
  return json(jobPath(id), parseJob, signal)
}
export function cancelAnalysisJob(id: string, signal: AbortSignal) {
  return json(jobPath(id), parseJob, signal, { method: 'DELETE' })
}
export function getAnalysisResult(id: string, signal: AbortSignal) {
  return json(
    `${jobPath(id)}/result`,
    parseResultEnvelope,
    signal,
    undefined,
    8 * 1024 * 1024,
  )
}
export function getAnalysisFeatures(id: string, signal: AbortSignal) {
  return json(
    `${jobPath(id)}/features`,
    parseAlignmentFeatures,
    signal,
    undefined,
    8 * 1024 * 1024,
  )
}
export async function getAnalysisAudio(
  id: string,
  signal: AbortSignal,
  guitar = false,
): Promise<Blob> {
  const response = await fetch(
    `${PREFIX}${jobPath(id)}/${guitar ? 'guitar-audio' : 'audio'}`,
    {
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
    },
  )
  if (!response.ok) return responseError(response)
  if (!response.headers.get('content-type')?.includes('audio/wav')) {
    await response.body?.cancel()
    throw new Error('The server did not return canonical playback audio.')
  }
  return new Blob([await boundedBody(response, MAX_AUDIO_BYTES)], {
    type: 'audio/wav',
  })
}
function delay(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}
/** Create/upload/poll/fetch within one deadline; release server artifacts on every exit. */
async function analyze(
  source: Source,
  options: AnalysisOptions,
  client: ClientOptions,
  file?: File,
) {
  const focus = client.focus ?? 'full_mix'
  // Guitar: longer than the server's worst case (upload 120 s + queue 60 s + active 2,700 s).
  const deadline = AbortSignal.timeout(focus === 'guitar' ? 3_000_000 : 420_000)
  const active = new AbortController()
  const signal = AbortSignal.any([client.signal, deadline, active.signal])
  let id: string | undefined
  try {
    const capabilities = await getAnalysisCapabilities(signal)
    if (
      !capabilities.modes.includes(options.mode) ||
      (source.kind === 'upload'
        ? !capabilities.uploads ||
          source.byteLength > capabilities.limits.maxSourceBytes
        : !capabilities.youtube)
    )
      throw new Error(
        'This source or analysis mode is unavailable on this server.',
      )
    if (focus === 'guitar' && !capabilities.separation.available)
      throw new AnalysisApiError({
        code: 'SEPARATOR_UNAVAILABLE',
        message:
          capabilities.separation.reason ?? 'Guitar separation is unavailable.',
        retryable: false,
      })
    let job = await createAnalysisJob({ source, options, focus }, signal)
    id = job.id
    client.onStatus(job)
    if (file) {
      job = await uploadAnalysisMedia(id, file, signal)
      client.onStatus(job)
    }
    let failures = 0
    while (job.status !== 'succeeded') {
      if (job.status === 'failed')
        throw new AnalysisApiError(
          job.error ?? {
            code: 'JOB_FAILED',
            message: 'Audio analysis failed. Try a different recording.',
            retryable: false,
          },
        )
      if (job.status === 'canceled')
        throw new AnalysisApiError({
          code: 'JOB_CANCELED',
          message: 'Analysis canceled.',
          retryable: true,
        })
      await delay(Math.min(10_000, 2000 * 2 ** failures), signal)
      try {
        job = await getAnalysisJob(id, signal)
        failures = 0
        client.onStatus(job)
      } catch (error) {
        if (
          (error instanceof TypeError ||
            (error instanceof AnalysisApiError && error.retryable)) &&
          ++failures <= 4
        )
          continue
        throw error
      }
    }
    const [result, features, audio, guitarAudio] = await Promise.all([
      getAnalysisResult(id, signal),
      getAnalysisFeatures(id, signal),
      getAnalysisAudio(id, signal),
      focus === 'guitar'
        ? getAnalysisAudio(id, signal, true)
        : Promise.resolve(undefined),
    ])
    signal.throwIfAborted()
    verifyFocus(result, focus, capabilities.separation.separator)
    // Both previews are 24 kHz mono WAVs on one timeline, so their sizes must match.
    if (guitarAudio && guitarAudio.size !== audio.size)
      throw new Error('The guitar preview does not match the song timeline.')
    if (
      result.jobId !== id ||
      JSON.stringify(result.source) !== JSON.stringify(source) ||
      JSON.stringify(result.analysis.options) !==
        JSON.stringify(parseOptions(options))
    )
      throw new Error(
        'The server returned analysis for a different recording or options.',
      )
    if (
      result.analysis.engineVersion !== features.engineVersion ||
      Math.abs(result.analysis.duration - features.duration) > 1e-6
    )
      throw new Error('Analysis and playback timing features do not match.')
    return { result, features, audio, guitarAudio }
  } catch (error) {
    if (deadline.aborted && !client.signal.aborted)
      throw new Error(
        'Analysis exceeded its time limit. Try a shorter recording.',
      )
    throw error
  } finally {
    active.abort()
    if (id)
      await cancelAnalysisJob(id, AbortSignal.timeout(3000)).catch(() => {})
  }
}
export function analyzeUploadedAudio(
  file: File,
  options: AnalysisOptions,
  client: ClientOptions,
) {
  const name =
    [...file.name]
      .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
      .join('')
      .slice(0, 200) || 'Recording'
  return analyze(
    parseSource({
      kind: 'upload',
      name,
      byteLength: file.size,
      contentType: file.type.slice(0, 200),
    }),
    options,
    client,
    file,
  )
}
export function analyzeYouTubeAudio(
  videoId: string,
  options: AnalysisOptions,
  client: ClientOptions,
) {
  return analyze(parseSource({ kind: 'youtube', videoId }), options, client)
}
