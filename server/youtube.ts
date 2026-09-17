import { spawn } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const ROUTE_PREFIX = '/api/youtube-audio/'
const DEFAULT_MAX_DURATION_SECONDS = 600
const DEFAULT_MAX_SOURCE_BYTES = 50 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 150 * 1000
const DEFAULT_CONCURRENCY = 2
const DEFAULT_RATE_LIMIT = 10
const DEFAULT_RATE_WINDOW_MS = 60 * 1000
const MAX_CAPTURED_OUTPUT_BYTES = 2 * 1024 * 1024
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export interface CommandOptions {
  cwd?: string
  signal: AbortSignal
}

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: CommandOptions,
) => Promise<CommandResult>

export interface YouTubeMiddlewareOptions {
  ytDlpPath?: string
  ffmpegPath?: string
  maxDurationSeconds?: number
  maxSourceBytes?: number
  timeoutMs?: number
  maxConcurrent?: number
  rateLimitMax?: number
  rateLimitWindowMs?: number
  tempRoot?: string
  runCommand?: CommandRunner
  now?: () => number
}

export type YouTubeMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) => void

interface VideoMetadata {
  duration: number
  hlsFormatId?: string
  title: string
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
  const number = positiveNumber(value, fallback)
  return Math.max(1, Math.floor(number))
}

function appendCaptured(current: string, chunk: Buffer): string {
  if (Buffer.byteLength(current) >= MAX_CAPTURED_OUTPUT_BYTES) return current

  const remaining = MAX_CAPTURED_OUTPUT_BYTES - Buffer.byteLength(current)
  return current + chunk.subarray(0, remaining).toString('utf8')
}

export const runCommand: CommandRunner = (command, args, options) =>
  new Promise((resolveCommand, rejectCommand) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    let forceKillTimer: NodeJS.Timeout | undefined

    const child = spawn(command, args, {
      cwd: options.cwd,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    const killProcessTree = (signal: NodeJS.Signals) => {
      if (!child.pid) return
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        }).unref()
        return
      }

      try {
        process.kill(-child.pid, signal)
      } catch {
        child.kill(signal)
      }
    }

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      options.signal.removeEventListener('abort', abort)
      if (forceKillTimer && !options.signal.aborted)
        clearTimeout(forceKillTimer)
      callback()
    }

    const abort = () => {
      if (child.exitCode !== null || child.signalCode !== null) return
      killProcessTree('SIGTERM')
      forceKillTimer = setTimeout(() => killProcessTree('SIGKILL'), 2_000)
      forceKillTimer.unref()
    }

    if (options.signal.aborted) abort()
    else options.signal.addEventListener('abort', abort, { once: true })

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendCaptured(stdout, chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendCaptured(stderr, chunk)
    })
    child.once('error', (error) => finish(() => rejectCommand(error)))
    child.once('close', (exitCode) =>
      finish(() =>
        resolveCommand({
          exitCode: exitCode ?? 1,
          stdout,
          stderr,
        }),
      ),
    )
  })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readPossibleFileSize(
  value: Record<string, unknown>,
): number | undefined {
  const exact = value.filesize
  if (typeof exact === 'number' && Number.isFinite(exact)) return exact

  const approximate = value.filesize_approx
  return typeof approximate === 'number' && Number.isFinite(approximate)
    ? approximate
    : undefined
}

function parseMetadata(
  stdout: string,
  maxDurationSeconds: number,
  maxSourceBytes: number,
): VideoMetadata {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new RequestError(
      502,
      'INVALID_METADATA',
      'YouTube returned video information in an unexpected format. Please try again.',
      true,
    )
  }

  if (!isRecord(parsed)) {
    throw new RequestError(
      502,
      'INVALID_METADATA',
      'YouTube returned video information in an unexpected format. Please try again.',
      true,
    )
  }

  if (parsed.is_live === true || parsed.live_status === 'is_live') {
    throw new RequestError(
      422,
      'LIVE_VIDEO_UNSUPPORTED',
      'Live videos cannot be analyzed. Use a finished public video up to 10 minutes long.',
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
      'This video does not report a usable duration and cannot be analyzed.',
    )
  }
  if (duration > maxDurationSeconds) {
    throw new RequestError(
      413,
      'VIDEO_TOO_LONG',
      `Videos must be ${maxDurationSeconds} seconds or shorter.`,
    )
  }

  const candidateSizes: number[] = []
  const ownSize = readPossibleFileSize(parsed)
  if (ownSize !== undefined) candidateSizes.push(ownSize)

  for (const key of ['requested_downloads', 'requested_formats'] as const) {
    const entries = parsed[key]
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      if (!isRecord(entry)) continue
      const size = readPossibleFileSize(entry)
      if (size !== undefined) candidateSizes.push(size)
    }
  }

  if (candidateSizes.some((size) => size > maxSourceBytes)) {
    throw new RequestError(
      413,
      'VIDEO_TOO_LARGE',
      'The selected audio stream is larger than the 50 MiB download limit.',
    )
  }

  const hlsFormats = Array.isArray(parsed.formats)
    ? parsed.formats.filter((format): format is Record<string, unknown> => {
        if (!isRecord(format)) return false
        const formatId = format.format_id
        const protocol = format.protocol
        const size = readPossibleFileSize(format)
        return (
          typeof formatId === 'string' &&
          /^[A-Za-z0-9._-]{1,64}$/.test(formatId) &&
          format.vcodec === 'none' &&
          typeof protocol === 'string' &&
          protocol.startsWith('m3u8') &&
          (size === undefined || size <= maxSourceBytes)
        )
      })
    : []
  hlsFormats.sort((left, right) => {
    const leftRate =
      typeof left.abr === 'number'
        ? left.abr
        : typeof left.tbr === 'number'
          ? left.tbr
          : 0
    const rightRate =
      typeof right.abr === 'number'
        ? right.abr
        : typeof right.tbr === 'number'
          ? right.tbr
          : 0
    return rightRate - leftRate
  })

  return {
    duration,
    ...(typeof hlsFormats[0]?.format_id === 'string'
      ? { hlsFormatId: hlsFormats[0].format_id }
      : {}),
    title:
      typeof parsed.title === 'string'
        ? parsed.title.slice(0, 300)
        : 'YouTube audio',
  }
}

async function removePartialSources(directory: string): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true })
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith('source.'))
      .map((entry) => rm(join(directory, entry.name), { force: true })),
  )
}

async function findDownloadedSource(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true })
  const candidates = entries.filter(
    (entry) =>
      entry.isFile() &&
      entry.name.startsWith('source.') &&
      !entry.name.endsWith('.part') &&
      !entry.name.endsWith('.ytdl'),
  )

  if (candidates.length !== 1) {
    throw new RequestError(
      502,
      'DOWNLOAD_FAILED',
      'The video audio could not be downloaded. It may be private, restricted, or unavailable.',
      true,
    )
  }

  return join(directory, candidates[0].name)
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

function safeHeaderTitle(title: string): string {
  const wellFormed = Array.from(title, (character) => {
    if (character.length !== 1) return character
    const code = character.charCodeAt(0)
    return code >= 0xd800 && code <= 0xdfff ? '\uFFFD' : character
  }).join('')
  return encodeURIComponent(wellFormed)
}

function errorFromUnknown(
  error: unknown,
  ytDlpPath: string,
  ffmpegPath: string,
): RequestError {
  if (error instanceof RequestError) return error
  if (error instanceof RequestTimeoutError) {
    return new RequestError(
      504,
      'REQUEST_TIMEOUT',
      'YouTube audio processing timed out. Please try again.',
      true,
    )
  }

  if (isRecord(error) && error.code === 'ENOENT') {
    const tool =
      error.path === ffmpegPath
        ? 'ffmpeg'
        : error.path === ytDlpPath
          ? 'yt-dlp'
          : 'A required tool'
    return new RequestError(
      503,
      'BACKEND_NOT_CONFIGURED',
      `${tool} is not installed on the server. Run npm run setup:youtube and install ffmpeg.`,
    )
  }

  return new RequestError(
    500,
    'INTERNAL_ERROR',
    'The server could not prepare this video for analysis. Please try again.',
    true,
  )
}

export function createYouTubeMiddleware(
  options: YouTubeMiddlewareOptions = {},
): YouTubeMiddleware {
  const ytDlpPath = options.ytDlpPath ?? defaultYtDlpPath()
  const ffmpegPath = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? 'ffmpeg'
  const maxDurationSeconds = positiveNumber(
    options.maxDurationSeconds,
    DEFAULT_MAX_DURATION_SECONDS,
  )
  const maxSourceBytes = positiveInteger(
    options.maxSourceBytes,
    DEFAULT_MAX_SOURCE_BYTES,
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
  const execute = options.runCommand ?? runCommand
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

    if (!requestUrl.pathname.startsWith(ROUTE_PREFIX)) return

    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      writeJsonError(
        response,
        new RequestError(
          405,
          'METHOD_NOT_ALLOWED',
          'Use GET for YouTube audio requests.',
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
          'Too many YouTube requests. Wait a moment and try again.',
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
          'The server is already processing other videos. Try again in a few seconds.',
          true,
        ),
      )
      return
    }

    activeRequests += 1
    const controller = new AbortController()
    const timeout = setTimeout(
      () =>
        controller.abort(new RequestTimeoutError('YouTube request timed out')),
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
      workingDirectory = await mkdtemp(join(tempRoot, 'fretbloom-youtube-'))
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
          '--dump-single-json',
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
        metadataResult.stdout,
        maxDurationSeconds,
        maxSourceBytes,
      )

      const outputTemplate = join(workingDirectory, 'source.%(ext)s')
      const download = (format: string) =>
        execute(
          ytDlpPath,
          [
            ...sharedArguments,
            '--format',
            format,
            '--abort-on-unavailable-fragments',
            '--max-filesize',
            String(maxSourceBytes),
            '--output',
            outputTemplate,
            '--',
            videoUrl,
          ],
          { cwd: workingDirectory, signal: controller.signal },
        )
      let downloadResult = await download('bestaudio/best')
      if (
        downloadResult.exitCode !== 0 &&
        metadata.hlsFormatId &&
        !controller.signal.aborted
      ) {
        await removePartialSources(workingDirectory)
        downloadResult = await download(metadata.hlsFormatId)
      }
      if (controller.signal.aborted) throw controller.signal.reason
      if (downloadResult.exitCode !== 0) {
        throw new RequestError(
          502,
          'DOWNLOAD_FAILED',
          'The video audio could not be downloaded. It may be private, restricted, or too large.',
          true,
        )
      }

      const sourcePath = await findDownloadedSource(workingDirectory)
      const sourceStats = await stat(sourcePath)
      if (sourceStats.size > maxSourceBytes) {
        throw new RequestError(
          413,
          'VIDEO_TOO_LARGE',
          'The selected audio stream is larger than the 50 MiB download limit.',
        )
      }

      const wavPath = join(workingDirectory, 'audio.wav')
      const conversionResult = await execute(
        ffmpegPath,
        [
          '-nostdin',
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          sourcePath,
          '-vn',
          '-ac',
          '1',
          '-ar',
          '12000',
          '-t',
          String(maxDurationSeconds),
          '-c:a',
          'pcm_s16le',
          '-f',
          'wav',
          '-y',
          wavPath,
        ],
        { cwd: workingDirectory, signal: controller.signal },
      )
      if (controller.signal.aborted) throw controller.signal.reason
      if (conversionResult.exitCode !== 0) {
        throw new RequestError(
          502,
          'CONVERSION_FAILED',
          'The downloaded audio could not be converted for analysis.',
          true,
        )
      }

      const wavStats = await stat(wavPath)
      const maxWavBytes = Math.ceil(
        maxDurationSeconds * 12_000 * 2 + 1024 * 1024,
      )
      if (wavStats.size > maxWavBytes) {
        throw new RequestError(
          502,
          'CONVERSION_FAILED',
          'The converted audio exceeded the expected size.',
          true,
        )
      }
      const wav = await readFile(wavPath)
      await rm(workingDirectory, { recursive: true, force: true })
      workingDirectory = undefined
      response.writeHead(200, {
        'Cache-Control': 'private, no-store',
        'Content-Type': 'audio/wav',
        'Content-Length': wavStats.size,
        'X-Content-Type-Options': 'nosniff',
        'X-Video-Title': safeHeaderTitle(metadata.title),
      })
      response.end(wav)
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
        writeJsonError(
          response,
          errorFromUnknown(reason, ytDlpPath, ffmpegPath),
        )
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
