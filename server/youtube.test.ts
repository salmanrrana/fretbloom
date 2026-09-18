import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createYouTubeMiddleware,
  runCommand,
  type CommandRunner,
  type YouTubeMiddlewareOptions,
} from './youtube.ts'

interface TestServer {
  baseUrl: string
  close: () => Promise<void>
}

interface CommandCall {
  command: string
  args: readonly string[]
}

const cleanupDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    cleanupDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function createTempRoot(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'fretbloom-youtube-test-'))
  cleanupDirectories.push(directory)
  return directory
}

async function startServer(
  options: YouTubeMiddlewareOptions,
): Promise<TestServer> {
  const middleware = createYouTubeMiddleware(options)
  const server = createServer((request, response) => {
    middleware(request, response, () => {
      response.writeHead(404).end('next')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Test server did not bind')

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server),
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function successfulRunner(
  calls: CommandCall[],
  metadata: Record<string, unknown> = {
    duration: 120,
    title: 'A&B 🎵',
    requested_downloads: [{ filesize: 1_024 }],
  },
): CommandRunner {
  return async (command, args) => {
    calls.push({ command, args })
    if (args.includes('--dump-single-json')) {
      return { exitCode: 0, stdout: JSON.stringify(metadata), stderr: '' }
    }

    if (command === 'fake-ytdlp') {
      const outputIndex = args.indexOf('--output')
      const outputTemplate = args[outputIndex + 1]
      await writeFile(outputTemplate.replace('%(ext)s', 'webm'), 'source audio')
      return { exitCode: 0, stdout: '', stderr: '' }
    }

    const outputPath = args.at(-1)
    if (!outputPath) throw new Error('Missing ffmpeg output path')
    await writeFile(outputPath, Buffer.from('RIFF-test-wave'))
    return { exitCode: 0, stdout: '', stderr: '' }
  }
}

describe('createYouTubeMiddleware', () => {
  it('passes unrelated routes to the next middleware', async () => {
    const tempRoot = await createTempRoot()
    const runCommand = vi.fn<CommandRunner>()
    const testServer = await startServer({ tempRoot, runCommand })

    try {
      const response = await fetch(`${testServer.baseUrl}/health`)
      expect(response.status).toBe(404)
      expect(await response.text()).toBe('next')
      expect(runCommand).not.toHaveBeenCalled()
    } finally {
      await testServer.close()
    }
  })

  it('rejects invalid IDs before starting a process', async () => {
    const tempRoot = await createTempRoot()
    const runCommand = vi.fn<CommandRunner>()
    const testServer = await startServer({ tempRoot, runCommand })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-audio/not-a-video-id`,
      )
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: {
          code: 'INVALID_VIDEO_ID',
          message: 'Provide a valid 11-character YouTube video ID.',
        },
      })
      expect(runCommand).not.toHaveBeenCalled()
    } finally {
      await testServer.close()
    }
  })

  it('returns converted WAV audio and removes its temporary directory', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const testServer = await startServer({
      tempRoot,
      ytDlpPath: 'fake-ytdlp',
      ffmpegPath: 'fake-ffmpeg',
      runCommand: successfulRunner(calls),
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-audio/dQw4w9WgXcQ?ignored=1`,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('audio/wav')
      expect(response.headers.get('x-video-title')).toBe('A%26B%20%F0%9F%8E%B5')
      expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
        'RIFF-test-wave',
      )

      expect(calls).toHaveLength(3)
      expect(calls[0].command).toBe('fake-ytdlp')
      expect(calls[0].args).toContain(`node:${process.execPath}`)
      expect(calls[0].args).not.toContain('--remote-components')
      expect(calls[0].args).toContain('--no-cookies')
      expect(calls[0].args).toContain('--no-cookies-from-browser')
      expect(calls[0].args.at(-1)).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      )
      expect(calls[1].args).toContain('--max-filesize')
      expect(calls[2].args).toEqual(
        expect.arrayContaining([
          '-ac',
          '1',
          '-ar',
          '12000',
          '-c:a',
          'pcm_s16le',
        ]),
      )
      expect(await readdir(tempRoot)).toEqual([])
    } finally {
      await testServer.close()
    }
  })

  it('rejects long videos after metadata and still cleans up', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const testServer = await startServer({
      tempRoot,
      ytDlpPath: 'fake-ytdlp',
      runCommand: successfulRunner(calls, {
        duration: 600.01,
        title: 'Too long',
      }),
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-audio/dQw4w9WgXcQ`,
      )
      expect(response.status).toBe(413)
      expect(await response.json()).toMatchObject({
        error: { code: 'VIDEO_TOO_LONG' },
      })
      expect(calls).toHaveLength(1)
      expect(await readdir(tempRoot)).toEqual([])
    } finally {
      await testServer.close()
    }
  })

  it('rejects a source that exceeds the configured byte limit', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const testServer = await startServer({
      tempRoot,
      maxSourceBytes: 8,
      ytDlpPath: 'fake-ytdlp',
      runCommand: successfulRunner(calls, {
        duration: 60,
        title: 'Large source',
      }),
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-audio/dQw4w9WgXcQ`,
      )
      expect(response.status).toBe(413)
      expect(await response.json()).toMatchObject({
        error: { code: 'VIDEO_TOO_LARGE' },
      })
      expect(calls).toHaveLength(2)
      expect(await readdir(tempRoot)).toEqual([])
    } finally {
      await testServer.close()
    }
  })

  it('retries a failed direct download with a metadata-selected audio HLS format', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const baseRunner = successfulRunner(calls, {
      duration: 597,
      title: 'HLS fixture',
      formats: [
        {
          format_id: 'video-hls',
          protocol: 'm3u8_native',
          vcodec: 'avc1',
          tbr: 500,
        },
        {
          format_id: 'audio-low',
          protocol: 'm3u8_native',
          vcodec: 'none',
          tbr: 64,
        },
        {
          format_id: 'audio-high',
          protocol: 'm3u8_native',
          vcodec: 'none',
          tbr: 128,
        },
      ],
    })
    let directDownloadFailed = false
    const runCommand: CommandRunner = async (command, args, options) => {
      if (
        command === 'fake-ytdlp' &&
        args.includes('--max-filesize') &&
        args[args.indexOf('--format') + 1] === 'bestaudio/best'
      ) {
        calls.push({ command, args })
        directDownloadFailed = true
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'sensitive downloader output',
        }
      }
      return baseRunner(command, args, options)
    }
    const testServer = await startServer({
      tempRoot,
      ytDlpPath: 'fake-ytdlp',
      ffmpegPath: 'fake-ffmpeg',
      runCommand,
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-audio/YE7VzlLtp-4`,
      )
      expect(response.status).toBe(200)
      await response.arrayBuffer()
      expect(directDownloadFailed).toBe(true)
      const retry = calls.find(
        (call) =>
          call.command === 'fake-ytdlp' &&
          call.args[call.args.indexOf('--format') + 1] === 'audio-high',
      )
      expect(retry).toBeDefined()
      expect(retry?.args).toContain('--abort-on-unavailable-fragments')
    } finally {
      await testServer.close()
    }
  })

  it('caps concurrent processing', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    let releaseMetadata: (() => void) | undefined
    const metadataPaused = new Promise<void>((resolve) => {
      releaseMetadata = resolve
    })
    let metadataStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      metadataStarted = resolve
    })
    const baseRunner = successfulRunner(calls)
    let firstMetadata = true
    const runCommand: CommandRunner = async (command, args, options) => {
      if (firstMetadata && args.includes('--dump-single-json')) {
        firstMetadata = false
        metadataStarted?.()
        await metadataPaused
      }
      return baseRunner(command, args, options)
    }
    const testServer = await startServer({
      tempRoot,
      maxConcurrent: 1,
      ytDlpPath: 'fake-ytdlp',
      ffmpegPath: 'fake-ffmpeg',
      runCommand,
    })

    try {
      const firstResponse = fetch(
        `${testServer.baseUrl}/api/youtube-audio/dQw4w9WgXcQ`,
      )
      await started
      const busyResponse = await fetch(
        `${testServer.baseUrl}/api/youtube-audio/abcdefghijk`,
      )
      expect(busyResponse.status).toBe(503)
      expect(await busyResponse.json()).toMatchObject({
        error: { code: 'SERVER_BUSY' },
      })

      releaseMetadata?.()
      expect((await firstResponse).status).toBe(200)
    } finally {
      releaseMetadata?.()
      await testServer.close()
    }
  })

  it('rate-limits repeated requests from the same connection address', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const testServer = await startServer({
      tempRoot,
      rateLimitMax: 1,
      ytDlpPath: 'fake-ytdlp',
      ffmpegPath: 'fake-ffmpeg',
      runCommand: successfulRunner(calls),
    })

    try {
      const firstResponse = await fetch(
        `${testServer.baseUrl}/api/youtube-audio/dQw4w9WgXcQ`,
      )
      expect(firstResponse.status).toBe(200)
      await firstResponse.arrayBuffer()

      const limitedResponse = await fetch(
        `${testServer.baseUrl}/api/youtube-audio/abcdefghijk`,
      )
      expect(limitedResponse.status).toBe(429)
      expect(limitedResponse.headers.get('retry-after')).toBe('60')
      expect(await limitedResponse.json()).toMatchObject({
        error: { code: 'RATE_LIMITED' },
      })
    } finally {
      await testServer.close()
    }
  })
})

describe('runCommand', () => {
  it.skipIf(process.platform === 'win32')(
    'kills descendant processes when an operation is aborted',
    async () => {
      const controller = new AbortController()
      const resultPromise = runCommand(
        process.execPath,
        [
          '-e',
          `const { spawn } = require('node:child_process'); const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); console.log(child.pid); setInterval(() => {}, 1000);`,
        ],
        { signal: controller.signal },
      )
      setTimeout(() => controller.abort(), 250)
      const result = await resultPromise
      const descendantPid = Number(result.stdout.trim())

      expect(Number.isInteger(descendantPid)).toBe(true)
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(() => process.kill(descendantPid, 0)).toThrow()
    },
  )
})
