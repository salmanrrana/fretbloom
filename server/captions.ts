import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  runCommand as defaultRunCommand,
  type CommandRunner,
} from './youtube.ts'

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const LANGUAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const ROUTE_PREFIX = '/api/youtube-captions/'
const DEFAULT_MAX_DURATION_SECONDS = 600
const DEFAULT_MAX_CAPTION_BYTES = 2 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 45 * 1000
const DEFAULT_CONCURRENCY = 2
const DEFAULT_RATE_LIMIT = 10
const DEFAULT_RATE_WINDOW_MS = 60 * 1000
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export interface CaptionCue {
  start: number
  end: number
  text: string
}

export interface CaptionResult {
  status: 'available' | 'unavailable'
  language: string | null
  automatic: boolean
  cues: CaptionCue[]
}

export interface YouTubeCaptionsMiddlewareOptions {
  ytDlpPath?: string
  maxDurationSeconds?: number
  maxCaptionBytes?: number
  timeoutMs?: number
  maxConcurrent?: number
  rateLimitMax?: number
  rateLimitWindowMs?: number
  tempRoot?: string
  runCommand?: CommandRunner
  now?: () => number
}

export type YouTubeCaptionsMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) => void

interface VideoMetadata {
  duration: number
  language: string | null
  subtitles: Record<string, unknown>
}

interface SelectedTrack {
  language: string
  automatic: boolean
  /** yt-dlp keys to try in order; plain source language is safe only when detected. */
  downloadLanguages: readonly string[]
}

interface RawCue extends CaptionCue {
  windowId: string | number | undefined
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

function unavailableResult(): CaptionResult {
  return {
    status: 'unavailable',
    language: null,
    automatic: false,
    cues: [],
  }
}

function writeJson(response: ServerResponse, body: CaptionResult): void {
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

function parseMetadata(
  stdout: string,
  maxDurationSeconds: number,
): VideoMetadata {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new RequestError(
      502,
      'INVALID_METADATA',
      'YouTube returned caption information in an unexpected format. Please try again.',
      true,
    )
  }

  if (!isRecord(parsed)) {
    throw new RequestError(
      502,
      'INVALID_METADATA',
      'YouTube returned caption information in an unexpected format. Please try again.',
      true,
    )
  }

  if (parsed.is_live === true || parsed.live_status === 'is_live') {
    throw new RequestError(
      422,
      'LIVE_VIDEO_UNSUPPORTED',
      'Live video captions are not supported. Use a finished public video up to 10 minutes long.',
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
      'This video does not report a usable duration and its captions cannot be loaded.',
    )
  }
  if (duration > maxDurationSeconds) {
    throw new RequestError(
      413,
      'VIDEO_TOO_LONG',
      `Videos must be ${maxDurationSeconds} seconds or shorter.`,
    )
  }

  return {
    duration,
    language:
      typeof parsed.language === 'string' &&
      LANGUAGE_PATTERN.test(parsed.language)
        ? parsed.language
        : null,
    subtitles: isRecord(parsed.subtitles) ? parsed.subtitles : {},
  }
}

function hasJson3Variant(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some((variant) => isRecord(variant) && variant.ext === 'json3')
  )
}

function baseLanguage(language: string): string {
  return language.toLowerCase().split(/[-_]/, 1)[0]
}

function languageRank(
  language: string,
  originalLanguage: string | null,
): number {
  const normalized = language.toLowerCase()
  const original = originalLanguage?.toLowerCase()
  if (original && normalized === original) return 0
  if (original && baseLanguage(normalized) === baseLanguage(original)) return 1
  if (normalized === 'en') return 2
  if (baseLanguage(normalized) === 'en') return 3
  return 4
}

function selectManualTrack(metadata: VideoMetadata): SelectedTrack | null {
  const languages = Object.entries(metadata.subtitles)
    .filter(
      ([language, variants]) =>
        language !== 'live_chat' &&
        LANGUAGE_PATTERN.test(language) &&
        hasJson3Variant(variants),
    )
    .map(([language]) => language)
    .sort((left, right) => {
      const rankDifference =
        languageRank(left, metadata.language) -
        languageRank(right, metadata.language)
      return rankDifference || left.localeCompare(right)
    })

  const language = languages[0]
  return language
    ? { language, automatic: false, downloadLanguages: [language] }
    : null
}

/**
 * Prefer YouTube's explicit `-orig` alias. A plain key is safe only when yt-dlp
 * derived that same language from the video's source automatic-caption track.
 */
function selectAutomaticTrack(metadata: VideoMetadata): SelectedTrack {
  const language = metadata.language ?? 'en'
  return {
    language,
    automatic: true,
    downloadLanguages: metadata.language
      ? [`${language}-orig`, language]
      : ['en-orig'],
  }
}

function normalizeCaptionText(text: string): string {
  const withoutControls = Array.from(text.normalize('NFC'), (character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 8 ||
      codePoint === 11 ||
      codePoint === 12 ||
      (codePoint >= 14 && codePoint <= 31) ||
      codePoint === 127
      ? ''
      : character
  }).join('')

  return withoutControls
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

function isCumulativeUpdate(previous: RawCue, current: RawCue): boolean {
  const sameWindow =
    previous.windowId !== undefined &&
    current.windowId !== undefined &&
    previous.windowId === current.windowId
  const sameStart = Math.abs(previous.start - current.start) < 0.1
  const overlaps = current.start < previous.end
  return (sameWindow || sameStart) && overlaps
}

function collapseRollingCues(cues: RawCue[]): CaptionCue[] {
  const collapsed: RawCue[] = []

  for (const cue of cues.sort((left, right) => left.start - right.start)) {
    const previous = collapsed.at(-1)
    if (!previous) {
      collapsed.push(cue)
      continue
    }

    if (previous.text === cue.text && cue.start <= previous.end + 0.1) {
      previous.end = Math.max(previous.end, cue.end)
      continue
    }

    if (isCumulativeUpdate(previous, cue)) {
      if (cue.text.startsWith(previous.text)) {
        previous.text = cue.text
        previous.end = Math.max(previous.end, cue.end)
        continue
      }
      if (previous.text.startsWith(cue.text)) {
        previous.end = Math.max(previous.end, cue.end)
        continue
      }
    }

    if (Math.abs(previous.start - cue.start) < 0.001) {
      previous.text = normalizeCaptionText(`${previous.text} ${cue.text}`)
      previous.end = Math.max(previous.end, cue.end)
      continue
    }

    collapsed.push(cue)
  }

  return collapsed.flatMap((cue, index) => {
    const nextStart = collapsed[index + 1]?.start
    const end =
      nextStart !== undefined && nextStart > cue.start
        ? Math.min(cue.end, nextStart)
        : cue.end
    return end > cue.start ? [{ start: cue.start, end, text: cue.text }] : []
  })
}

/** Parse YouTube's json3 subtitle format without treating rolling updates as new lines. */
export function parseJson3Captions(
  input: string,
  videoDurationSeconds: number,
): CaptionCue[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new RequestError(
      502,
      'INVALID_CAPTIONS',
      'YouTube returned captions in an unexpected format. Please try again.',
      true,
    )
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.events)) {
    throw new RequestError(
      502,
      'INVALID_CAPTIONS',
      'YouTube returned captions in an unexpected format. Please try again.',
      true,
    )
  }

  const cues: RawCue[] = []
  for (const event of parsed.events) {
    if (!isRecord(event) || !Array.isArray(event.segs)) continue
    const startMs = event.tStartMs
    const durationMs = event.dDurationMs
    if (
      typeof startMs !== 'number' ||
      !Number.isFinite(startMs) ||
      startMs < 0 ||
      typeof durationMs !== 'number' ||
      !Number.isFinite(durationMs) ||
      durationMs <= 0
    ) {
      continue
    }

    const text = normalizeCaptionText(
      event.segs
        .map((segment) =>
          isRecord(segment) && typeof segment.utf8 === 'string'
            ? segment.utf8
            : '',
        )
        .join(''),
    )
    if (!text) continue

    const start = startMs / 1_000
    const end = Math.min((startMs + durationMs) / 1_000, videoDurationSeconds)
    if (start >= videoDurationSeconds || end <= start) continue

    const windowId = event.wWinId
    cues.push({
      start,
      end,
      text,
      windowId:
        typeof windowId === 'number' || typeof windowId === 'string'
          ? windowId
          : undefined,
    })
  }

  return collapseRollingCues(cues)
}

async function findCaptionFile(
  directory: string,
  maxCaptionBytes: number,
): Promise<string | null> {
  const entries = await readdir(directory, { withFileTypes: true })
  const candidates = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith('.json3'),
  )
  if (candidates.length === 0) return null
  if (candidates.length !== 1) {
    throw new RequestError(
      502,
      'AMBIGUOUS_CAPTIONS',
      'YouTube returned more than one caption file for the selected language.',
      true,
    )
  }

  const path = join(directory, candidates[0].name)
  if ((await stat(path)).size > maxCaptionBytes) {
    throw new RequestError(
      413,
      'CAPTIONS_TOO_LARGE',
      'The selected captions exceed the 2 MiB limit.',
    )
  }
  return path
}

function errorFromUnknown(error: unknown, ytDlpPath: string): RequestError {
  if (error instanceof RequestError) return error
  if (error instanceof RequestTimeoutError) {
    return new RequestError(
      504,
      'REQUEST_TIMEOUT',
      'YouTube caption retrieval timed out. Please try again.',
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
    500,
    'INTERNAL_ERROR',
    'The server could not load captions for this video. Please try again.',
    true,
  )
}

export function createYouTubeCaptionsMiddleware(
  options: YouTubeCaptionsMiddlewareOptions = {},
): YouTubeCaptionsMiddleware {
  const ytDlpPath = options.ytDlpPath ?? defaultYtDlpPath()
  const maxDurationSeconds = positiveNumber(
    options.maxDurationSeconds,
    DEFAULT_MAX_DURATION_SECONDS,
  )
  const maxCaptionBytes = positiveInteger(
    options.maxCaptionBytes,
    DEFAULT_MAX_CAPTION_BYTES,
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
  const tempRoot = options.tempRoot ?? tmpdir()
  const execute = options.runCommand ?? defaultRunCommand
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
          'Use GET for YouTube caption requests.',
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
          'Too many YouTube caption requests. Wait a moment and try again.',
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
          'The server is already loading other captions. Try again in a few seconds.',
          true,
        ),
      )
      return
    }

    activeRequests += 1
    const controller = new AbortController()
    const timeout = setTimeout(
      () =>
        controller.abort(new RequestTimeoutError('Caption request timed out')),
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

    let workingDirectory: string | undefined
    try {
      workingDirectory = await mkdtemp(
        join(tempRoot, 'fretbloom-youtube-captions-'),
      )
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
      const sharedArguments = [
        '--ignore-config',
        '--no-cookies',
        '--no-cookies-from-browser',
        '--no-playlist',
        '--no-progress',
        '--no-warnings',
        '--js-runtimes',
        `node:${process.execPath}`,
      ] as const

      const metadataResult = await execute(
        ytDlpPath,
        [
          ...sharedArguments,
          '--format',
          'bestaudio/best',
          '--print',
          '%(.{duration,is_live,live_status,language,subtitles})j',
          '--skip-download',
          '--',
          videoUrl,
        ],
        { cwd: workingDirectory, signal: controller.signal },
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

      const metadata = parseMetadata(
        metadataResult.stdout.trim(),
        maxDurationSeconds,
      )
      const manualTrack = selectManualTrack(metadata)
      const selectedTrack = manualTrack ?? selectAutomaticTrack(metadata)
      const outputTemplate = join(workingDirectory, 'captions.%(ext)s')
      let captionPath: string | null = null
      for (const downloadLanguage of selectedTrack.downloadLanguages) {
        const downloadResult = await execute(
          ytDlpPath,
          [
            ...sharedArguments,
            '--skip-download',
            ...(selectedTrack.automatic
              ? ['--no-write-subs', '--write-auto-subs']
              : ['--write-subs', '--no-write-auto-subs']),
            '--sub-langs',
            downloadLanguage,
            '--sub-format',
            'json3',
            '--output',
            outputTemplate,
            '--',
            videoUrl,
          ],
          { cwd: workingDirectory, signal: controller.signal },
        )
        if (controller.signal.aborted) throw controller.signal.reason
        if (downloadResult.exitCode !== 0) {
          throw new RequestError(
            502,
            'CAPTION_DOWNLOAD_FAILED',
            'The selected YouTube captions could not be downloaded. Please try again.',
            true,
          )
        }

        captionPath = await findCaptionFile(workingDirectory, maxCaptionBytes)
        if (captionPath) break
      }
      if (!captionPath) {
        await rm(workingDirectory, { recursive: true, force: true })
        workingDirectory = undefined
        writeJson(response, unavailableResult())
        return
      }

      const cues = parseJson3Captions(
        await readFile(captionPath, 'utf8'),
        metadata.duration,
      )
      await rm(workingDirectory, { recursive: true, force: true })
      workingDirectory = undefined
      writeJson(
        response,
        cues.length === 0
          ? unavailableResult()
          : {
              status: 'available',
              language: selectedTrack.language,
              automatic: selectedTrack.automatic,
              cues,
            },
      )
    } catch (error) {
      const reason = controller.signal.aborted
        ? controller.signal.reason
        : error
      if (workingDirectory) {
        await rm(workingDirectory, { recursive: true, force: true }).catch(
          () => undefined,
        )
        workingDirectory = undefined
      }
      if (!(reason instanceof ClientDisconnectedError)) {
        writeJsonError(response, errorFromUnknown(reason, ytDlpPath))
      }
    } finally {
      clearTimeout(timeout)
      request.removeListener('aborted', disconnect)
      response.removeListener('close', disconnect)
      if (workingDirectory) {
        await rm(workingDirectory, { recursive: true, force: true }).catch(
          () => undefined,
        )
      }
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
