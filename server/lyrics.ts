import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  runCommand as defaultRunCommand,
  type CommandRunner,
} from './youtube.ts'

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const ROUTE_PREFIX = '/api/youtube-lyrics/'
const LRCLIB_GET_URL = 'https://lrclib.net/api/get'
const LRCLIB_HOME_URL = 'https://lrclib.net'
const LRCLIB_USER_AGENT =
  'FretBloom/0.0.0 (https://github.com/salmanrrana/fretbloom)'
const DEFAULT_MAX_DURATION_SECONDS = 600
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024
const DEFAULT_TIMEOUT_MS = 45 * 1000
const DEFAULT_CONCURRENCY = 2
const DEFAULT_RATE_LIMIT = 10
const DEFAULT_RATE_WINDOW_MS = 60 * 1000
const MAX_METADATA_LENGTH = 300
const MAX_CUES = 5_000
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export interface LyricsCue {
  start: number
  end: number
  text: string
}

export interface LyricsResult {
  status: 'available' | 'unavailable'
  language: string | null
  automatic: false
  cues: LyricsCue[]
  source: 'lyrics'
  attribution: {
    name: 'LRCLIB'
    url: typeof LRCLIB_HOME_URL
  }
}

export interface YouTubeLyricsMiddlewareOptions {
  ytDlpPath?: string
  maxDurationSeconds?: number
  maxResponseBytes?: number
  timeoutMs?: number
  maxConcurrent?: number
  rateLimitMax?: number
  rateLimitWindowMs?: number
  runCommand?: CommandRunner
  fetchImpl?: typeof fetch
  now?: () => number
}

export type YouTubeLyricsMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) => void

interface TrackMetadata {
  track: string
  artist: string
  album: string | null
  duration: number
}

interface LrclibRecord {
  trackName: string
  artistName: string
  albumName: string | null
  duration: number
  instrumental: boolean
  syncedLyrics: string | null
}

interface TimedLine {
  start: number
  text: string
}

interface JsonErrorBody {
  error: {
    code: string
    message: string
    retryable?: boolean
  }
}

class RequestError extends Error {
  readonly status: number
  readonly code: string
  readonly retryable: boolean

  constructor(
    status: number,
    code: string,
    message: string,
    retryable = false,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

class ClientDisconnectedError extends Error {}
class RequestTimeoutError extends Error {}

function defaultYtDlpPath(): string {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH

  return process.platform === 'win32'
    ? join(PROJECT_ROOT, '.tools', 'youtube', 'Scripts', 'yt-dlp.exe')
    : join(PROJECT_ROOT, '.tools', 'youtube', 'bin', 'yt-dlp')
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Math.max(1, Math.floor(positiveNumber(value, fallback)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unavailableResult(): LyricsResult {
  return {
    status: 'unavailable',
    language: null,
    automatic: false,
    cues: [],
    source: 'lyrics',
    attribution: { name: 'LRCLIB', url: LRCLIB_HOME_URL },
  }
}

function writeJson(response: ServerResponse, body: LyricsResult): void {
  if (response.headersSent || response.destroyed) return

  const json = JSON.stringify(body)
  response.writeHead(200, {
    'Cache-Control': 'private, no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(json)
}

function writeJsonError(response: ServerResponse, error: RequestError): void {
  if (response.headersSent || response.destroyed) return

  const body: JsonErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.retryable ? { retryable: true } : {}),
    },
  }
  const json = JSON.stringify(body)
  response.writeHead(error.status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(json)
}

function boundedMetadataString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_METADATA_LENGTH
    ? trimmed
    : null
}

function parseTrackMetadata(
  stdout: string,
  maxDurationSeconds: number,
): TrackMetadata | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new RequestError(
      502,
      'INVALID_METADATA',
      'YouTube returned track information in an unexpected format. Please try again.',
      true,
    )
  }

  if (!isRecord(parsed)) {
    throw new RequestError(
      502,
      'INVALID_METADATA',
      'YouTube returned track information in an unexpected format. Please try again.',
      true,
    )
  }
  if (parsed.is_live === true || parsed.live_status === 'is_live') {
    throw new RequestError(
      422,
      'LIVE_VIDEO_UNSUPPORTED',
      'Live video lyrics are not supported. Use a finished public video up to 10 minutes long.',
    )
  }

  const duration = parsed.duration
  if (
    typeof duration !== 'number' ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    throw new RequestError(
      422,
      'DURATION_UNAVAILABLE',
      'This video does not report a usable duration and cannot be matched to synced lyrics.',
    )
  }
  if (duration > maxDurationSeconds) {
    throw new RequestError(
      413,
      'VIDEO_TOO_LONG',
      `Videos must be ${maxDurationSeconds} seconds or shorter.`,
    )
  }

  const track = boundedMetadataString(parsed.track)
  const artist = boundedMetadataString(parsed.artist)
  if (!track || !artist) return null

  return {
    track,
    artist,
    album: boundedMetadataString(parsed.album),
    duration,
  }
}

function parseLrclibRecord(value: unknown): LrclibRecord | null {
  if (!isRecord(value)) return null
  const trackName = boundedMetadataString(value.trackName)
  const artistName = boundedMetadataString(value.artistName)
  const duration = value.duration
  if (
    !trackName ||
    !artistName ||
    typeof duration !== 'number' ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    typeof value.instrumental !== 'boolean'
  ) {
    return null
  }

  return {
    trackName,
    artistName,
    albumName: boundedMetadataString(value.albumName),
    duration,
    instrumental: value.instrumental,
    syncedLyrics:
      typeof value.syncedLyrics === 'string' ? value.syncedLyrics : null,
  }
}

function normalizeIdentity(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ')
}

function isTrustworthyMatch(
  metadata: TrackMetadata,
  record: LrclibRecord,
): boolean {
  return (
    normalizeIdentity(metadata.track) === normalizeIdentity(record.trackName) &&
    normalizeIdentity(metadata.artist) ===
      normalizeIdentity(record.artistName) &&
    Math.abs(metadata.duration - record.duration) <= 2
  )
}

function parseTimestamp(
  minutesText: string,
  secondsText: string,
  fractionText: string | undefined,
): number | null {
  const minutes = Number(minutesText)
  const seconds = Number(secondsText)
  if (
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    seconds >= 60
  ) {
    return null
  }
  const fraction = fractionText ? Number(`0.${fractionText}`) : 0
  const timestamp = minutes * 60 + seconds + fraction
  return Number.isFinite(timestamp) ? timestamp : null
}

/** Parse only explicit LRC timestamps; plain or mixed text is never timed. */
export function parseSyncedLyrics(
  text: string,
  duration: number,
): LyricsCue[] | null {
  if (!Number.isFinite(duration) || duration <= 0) return null

  const offsetMilliseconds = Number(
    text.match(/^\s*\[offset:([+-]?\d+)\]\s*$/im)?.[1] ?? 0,
  )
  if (!Number.isFinite(offsetMilliseconds)) return null
  const offsetSeconds = offsetMilliseconds / 1_000
  const timed: TimedLine[] = []
  let hasUntimedText = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || /^\[(?:ar|ti|al|by|offset|length|re|ve):/i.test(line)) {
      continue
    }
    const stamps = [
      ...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g),
    ]
    const words = line
      .replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '')
      .replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g, '')
      .replace(/\s+/gu, ' ')
      .trim()
    if (stamps.length === 0) {
      if (words) hasUntimedText = true
      continue
    }

    for (const stamp of stamps) {
      const timestamp = parseTimestamp(stamp[1], stamp[2], stamp[3])
      if (timestamp === null) return null
      const start = timestamp - offsetSeconds
      if (start < 0 || start > duration + 2) return null
      if (start < duration) timed.push({ start, text: words })
    }
    if (timed.length > MAX_CUES) return null
  }

  if (hasUntimedText || timed.length === 0) return null
  timed.sort((left, right) => left.start - right.start)
  if (
    timed.some(
      (line, index) => index > 0 && line.start <= timed[index - 1].start,
    )
  ) {
    return null
  }

  return timed.flatMap((line, index) => {
    const end = timed[index + 1]?.start ?? duration
    return line.text && end > line.start
      ? [{ start: line.start, end, text: line.text }]
      : []
  })
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RequestError(
      502,
      'LYRICS_RESPONSE_TOO_LARGE',
      'The lyrics service returned more data than this server accepts.',
      true,
    )
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new RequestError(
        502,
        'LYRICS_RESPONSE_TOO_LARGE',
        'The lyrics service returned more data than this server accepts.',
        true,
      )
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks, total).toString('utf8')
}

function errorFromUnknown(error: unknown, ytDlpPath: string): RequestError {
  if (error instanceof RequestError) return error
  if (error instanceof RequestTimeoutError) {
    return new RequestError(
      504,
      'REQUEST_TIMEOUT',
      'Synced lyric lookup timed out. Please try again.',
      true,
    )
  }
  if (isRecord(error) && error.code === 'ENOENT') {
    return new RequestError(
      503,
      'BACKEND_NOT_CONFIGURED',
      `${error.path === ytDlpPath ? 'yt-dlp' : 'A required tool'} is not installed on the server. Run npm run setup:youtube.`,
    )
  }
  return new RequestError(
    502,
    'LYRICS_LOOKUP_FAILED',
    'The synced lyrics service could not be reached. Please try again.',
    true,
  )
}

export function createYouTubeLyricsMiddleware(
  options: YouTubeLyricsMiddlewareOptions = {},
): YouTubeLyricsMiddleware {
  const ytDlpPath = options.ytDlpPath ?? defaultYtDlpPath()
  const maxDurationSeconds = positiveNumber(
    options.maxDurationSeconds,
    DEFAULT_MAX_DURATION_SECONDS,
  )
  const maxResponseBytes = positiveInteger(
    options.maxResponseBytes,
    DEFAULT_MAX_RESPONSE_BYTES,
  )
  const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS)
  const maxConcurrent = positiveInteger(
    options.maxConcurrent,
    DEFAULT_CONCURRENCY,
  )
  const rateLimitMax = positiveInteger(options.rateLimitMax, DEFAULT_RATE_LIMIT)
  const rateLimitWindowMs = positiveInteger(
    options.rateLimitWindowMs,
    DEFAULT_RATE_WINDOW_MS,
  )
  const execute = options.runCommand ?? defaultRunCommand
  const requestLyrics = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const requestsByAddress = new Map<string, number[]>()
  let activeRequests = 0

  const handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    let requestUrl: URL
    try {
      requestUrl = new URL(request.url ?? '/', 'http://localhost')
    } catch {
      writeJsonError(
        response,
        new RequestError(400, 'INVALID_REQUEST', 'The request URL is invalid.'),
      )
      return
    }

    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      writeJsonError(
        response,
        new RequestError(
          405,
          'METHOD_NOT_ALLOWED',
          'Use GET for YouTube lyric requests.',
        ),
      )
      return
    }

    const videoId = requestUrl.pathname.slice(ROUTE_PREFIX.length)
    if (!VIDEO_ID_PATTERN.test(videoId)) {
      writeJsonError(
        response,
        new RequestError(
          400,
          'INVALID_VIDEO_ID',
          'Provide a valid 11-character YouTube video ID.',
        ),
      )
      return
    }

    const currentTime = now()
    const clientAddress = request.socket.remoteAddress ?? 'unknown'
    const recentRequests = (requestsByAddress.get(clientAddress) ?? []).filter(
      (timestamp) => currentTime - timestamp < rateLimitWindowMs,
    )
    if (recentRequests.length >= rateLimitMax) {
      const retryAfterMs = rateLimitWindowMs - (currentTime - recentRequests[0])
      response.setHeader(
        'Retry-After',
        Math.max(1, Math.ceil(retryAfterMs / 1_000)),
      )
      writeJsonError(
        response,
        new RequestError(
          429,
          'RATE_LIMITED',
          'Too many synced lyric requests. Wait a moment and try again.',
          true,
        ),
      )
      return
    }
    recentRequests.push(currentTime)
    requestsByAddress.set(clientAddress, recentRequests)

    if (activeRequests >= maxConcurrent) {
      response.setHeader('Retry-After', '5')
      writeJsonError(
        response,
        new RequestError(
          503,
          'SERVER_BUSY',
          'The server is already looking up other lyrics. Try again in a few seconds.',
          true,
        ),
      )
      return
    }

    activeRequests += 1
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(new RequestTimeoutError('Lyric lookup timed out')),
      timeoutMs,
    )
    timeout.unref()
    const disconnect = () => {
      if (!response.writableFinished) {
        controller.abort(new ClientDisconnectedError('Client disconnected'))
      }
    }
    request.once('aborted', disconnect)
    response.once('close', disconnect)

    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
      const metadataResult = await execute(
        ytDlpPath,
        [
          '--ignore-config',
          '--no-cookies',
          '--no-cookies-from-browser',
          '--no-playlist',
          '--no-progress',
          '--no-warnings',
          '--js-runtimes',
          `node:${process.execPath}`,
          '--format',
          'bestaudio/best',
          '--print',
          '%(.{track,artist,album,duration,is_live,live_status})j',
          '--skip-download',
          '--',
          videoUrl,
        ],
        { signal: controller.signal },
      )
      if (controller.signal.aborted) throw controller.signal.reason
      if (metadataResult.exitCode !== 0) {
        throw new RequestError(
          422,
          'VIDEO_UNAVAILABLE',
          'This public YouTube video could not be read. It may be private, restricted, or unavailable.',
          true,
        )
      }

      const metadata = parseTrackMetadata(
        metadataResult.stdout.trim(),
        maxDurationSeconds,
      )
      if (!metadata) {
        writeJson(response, unavailableResult())
        return
      }

      const lrclibUrl = new URL(LRCLIB_GET_URL)
      lrclibUrl.search = new URLSearchParams({
        track_name: metadata.track,
        artist_name: metadata.artist,
        duration: String(Math.round(metadata.duration)),
      }).toString()
      const lrclibResponse = await requestLyrics(lrclibUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': LRCLIB_USER_AGENT,
        },
        signal: controller.signal,
      })
      if (controller.signal.aborted) throw controller.signal.reason

      if (lrclibResponse.status === 404) {
        await lrclibResponse.body?.cancel().catch(() => undefined)
        writeJson(response, unavailableResult())
        return
      }
      if (lrclibResponse.status === 429) {
        const retryAfter = lrclibResponse.headers.get('retry-after')
        if (retryAfter && /^\d{1,6}$/.test(retryAfter)) {
          response.setHeader('Retry-After', retryAfter)
        }
        await lrclibResponse.body?.cancel().catch(() => undefined)
        throw new RequestError(
          503,
          'LYRICS_RATE_LIMITED',
          'The synced lyrics service is temporarily rate-limited. Try again later.',
          true,
        )
      }
      if (!lrclibResponse.ok) {
        await lrclibResponse.body?.cancel().catch(() => undefined)
        throw new RequestError(
          502,
          'LYRICS_UPSTREAM_FAILED',
          'The synced lyrics service returned an error. Please try again.',
          true,
        )
      }

      const body = await readBoundedBody(lrclibResponse, maxResponseBytes)
      let parsedBody: unknown
      try {
        parsedBody = JSON.parse(body)
      } catch {
        throw new RequestError(
          502,
          'INVALID_LYRICS_RESPONSE',
          'The synced lyrics service returned an unexpected response.',
          true,
        )
      }
      const record = parseLrclibRecord(parsedBody)
      if (
        !record ||
        !isTrustworthyMatch(metadata, record) ||
        record.instrumental ||
        !record.syncedLyrics
      ) {
        writeJson(response, unavailableResult())
        return
      }

      const cues = parseSyncedLyrics(record.syncedLyrics, metadata.duration)
      writeJson(
        response,
        cues?.length
          ? {
              status: 'available',
              language: null,
              automatic: false,
              cues,
              source: 'lyrics',
              attribution: { name: 'LRCLIB', url: LRCLIB_HOME_URL },
            }
          : unavailableResult(),
      )
    } catch (error) {
      const reason = controller.signal.aborted
        ? controller.signal.reason
        : error
      if (!(reason instanceof ClientDisconnectedError)) {
        writeJsonError(response, errorFromUnknown(reason, ytDlpPath))
      }
    } finally {
      clearTimeout(timeout)
      request.removeListener('aborted', disconnect)
      response.removeListener('close', disconnect)
      activeRequests -= 1
    }
  }

  return (request, response, next) => {
    let pathname = ''
    try {
      pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    } catch {
      pathname = ROUTE_PREFIX
    }
    if (!pathname.startsWith(ROUTE_PREFIX)) {
      next()
      return
    }

    void handleRequest(request, response)
  }
}
