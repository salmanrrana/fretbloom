import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createYouTubeCaptionsMiddleware,
  parseJson3Captions,
  type YouTubeCaptionsMiddlewareOptions,
} from './captions.ts'
import type { CommandRunner } from './youtube.ts'

interface TestServer {
  baseUrl: string
  close: () => Promise<void>
}

interface CommandCall {
  command: string
  args: readonly string[]
}

const VIDEO_ID = 'dQw4w9WgXcQ'
const cleanupDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    cleanupDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function createTempRoot(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'fretbloom-captions-test-'))
  cleanupDirectories.push(directory)
  return directory
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

async function startServer(
  options: YouTubeCaptionsMiddlewareOptions,
): Promise<TestServer> {
  const middleware = createYouTubeCaptionsMiddleware(options)
  const server = createServer((request, response) => {
    middleware(request, response, () => response.writeHead(404).end('next'))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server),
  }
}

function json3(...events: Record<string, unknown>[]): string {
  return JSON.stringify({ events })
}

function successfulRunner(
  calls: CommandCall[],
  metadata: Record<string, unknown>,
  captions = json3({
    tStartMs: 1_000,
    dDurationMs: 2_000,
    segs: [{ utf8: 'Caption line' }],
  }),
): CommandRunner {
  return async (command, args, options) => {
    calls.push({ command, args })
    if (args.includes('--print')) {
      return { exitCode: 0, stdout: JSON.stringify(metadata), stderr: '' }
    }

    const outputIndex = args.indexOf('--output')
    const outputTemplate = args[outputIndex + 1]
    await writeFile(outputTemplate.replace('%(ext)s', 'en.json3'), captions)
    expect(options.cwd).toBeTruthy()
    return { exitCode: 0, stdout: '', stderr: '' }
  }
}

describe('parseJson3Captions', () => {
  it('normalizes text, collapses rolling updates, and returns ordered non-overlapping cues', () => {
    const result = parseJson3Captions(
      json3(
        {
          tStartMs: 1_500,
          dDurationMs: 2_500,
          wWinId: 1,
          segs: [{ utf8: ' Hello\u00a0' }, { utf8: 'world\u200b ' }],
        },
        {
          tStartMs: 1_000,
          dDurationMs: 2_000,
          wWinId: 1,
          segs: [{ utf8: 'Hello' }],
        },
        {
          tStartMs: 3_500,
          dDurationMs: 2_000,
          wWinId: 2,
          segs: [{ utf8: 'Second line' }],
        },
        {
          tStartMs: 4_000,
          dDurationMs: 1_000,
          segs: [{ utf8: '   ' }],
        },
      ),
      5,
    )

    expect(result).toEqual([
      { start: 1, end: 3.5, text: 'Hello world' },
      { start: 3.5, end: 5, text: 'Second line' },
    ])
  })

  it('removes duplicate adjacent events and ignores unusable event shapes', () => {
    const result = parseJson3Captions(
      json3(
        {
          tStartMs: 0,
          dDurationMs: 1_000,
          segs: [{ utf8: 'Same' }],
        },
        {
          tStartMs: 900,
          dDurationMs: 1_100,
          segs: [{ utf8: 'Same' }],
        },
        { tStartMs: 2_000, segs: [{ utf8: 'No duration' }] },
        { tStartMs: 3_000, dDurationMs: 1_000, segs: 'unsupported' },
      ),
      10,
    )

    expect(result).toEqual([{ start: 0, end: 2, text: 'Same' }])
  })

  it('merges distinct same-start events so simultaneous windows cannot overlap', () => {
    const result = parseJson3Captions(
      json3(
        {
          tStartMs: 1_000,
          dDurationMs: 2_000,
          wWinId: 1,
          segs: [{ utf8: 'First voice' }],
        },
        {
          tStartMs: 1_000,
          dDurationMs: 1_500,
          wWinId: 2,
          segs: [{ utf8: 'Second voice' }],
        },
      ),
      10,
    )

    expect(result).toEqual([
      { start: 1, end: 3, text: 'First voice Second voice' },
    ])
  })

  it('rejects malformed or unsupported json3 documents', () => {
    expect(() => parseJson3Captions('{', 10)).toThrow(
      'YouTube returned captions in an unexpected format',
    )
    expect(() => parseJson3Captions('{"events":null}', 10)).toThrow(
      'YouTube returned captions in an unexpected format',
    )
  })
})

describe('createYouTubeCaptionsMiddleware', () => {
  it('passes unrelated routes through and rejects malformed IDs before spawning', async () => {
    const tempRoot = await createTempRoot()
    const runCommand = vi.fn<CommandRunner>()
    const testServer = await startServer({ tempRoot, runCommand })

    try {
      const unrelated = await fetch(`${testServer.baseUrl}/health`)
      expect(unrelated.status).toBe(404)
      expect(await unrelated.text()).toBe('next')

      const invalid = await fetch(
        `${testServer.baseUrl}/api/youtube-captions/not-a-video-id`,
      )
      expect(invalid.status).toBe(400)
      expect(await invalid.json()).toEqual({
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

  it('prefers detected-language manual captions and cleans up its workspace', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const testServer = await startServer({
      tempRoot,
      ytDlpPath: 'fake-ytdlp',
      runCommand: successfulRunner(calls, {
        duration: 60,
        language: 'fr',
        subtitles: {
          en: [{ ext: 'json3', url: 'https://captions.example/en' }],
          fr: [{ ext: 'json3', url: 'https://captions.example/fr' }],
        },
      }),
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-captions/${VIDEO_ID}?ignored=1`,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        status: 'available',
        language: 'fr',
        automatic: false,
        cues: [{ start: 1, end: 3, text: 'Caption line' }],
      })
      expect(calls).toHaveLength(2)
      expect(calls[0].command).toBe('fake-ytdlp')
      expect(calls[0].args).toContain('--no-cookies')
      expect(calls[0].args.at(-1)).toBe(
        `https://www.youtube.com/watch?v=${VIDEO_ID}`,
      )
      expect(calls[1].args).toEqual(
        expect.arrayContaining([
          '--write-subs',
          '--no-write-auto-subs',
          '--sub-langs',
          'fr',
          '--sub-format',
          'json3',
        ]),
      )
      expect(await readdir(tempRoot)).toEqual([])
    } finally {
      await testServer.close()
    }
  })

  it('prefers English when the original language has no manual track', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const testServer = await startServer({
      tempRoot,
      ytDlpPath: 'fake-ytdlp',
      runCommand: successfulRunner(calls, {
        duration: 60,
        language: 'es',
        subtitles: {
          de: [{ ext: 'json3' }],
          'en-US': [{ ext: 'json3' }],
        },
      }),
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-captions/${VIDEO_ID}`,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        status: 'available',
        language: 'en-US',
        automatic: false,
      })
      expect(
        calls[1].args.slice(calls[1].args.indexOf('--sub-langs'), -1),
      ).toEqual(expect.arrayContaining(['--sub-langs', 'en-US']))
    } finally {
      await testServer.close()
    }
  })

  it('uses only an original automatic track when manual captions are absent', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const testServer = await startServer({
      tempRoot,
      ytDlpPath: 'fake-ytdlp',
      runCommand: successfulRunner(calls, {
        duration: 60,
        language: 'ja',
        subtitles: {},
      }),
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-captions/${VIDEO_ID}`,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        status: 'available',
        language: 'ja',
        automatic: true,
      })
      expect(calls[1].args).toEqual(
        expect.arrayContaining([
          '--no-write-subs',
          '--write-auto-subs',
          '--sub-langs',
          'ja-orig',
        ]),
      )
    } finally {
      await testServer.close()
    }
  })

  it('falls back to a plain automatic key only for yt-dlp detected source language', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const captions = json3({
      tStartMs: 0,
      dDurationMs: 1_000,
      segs: [{ utf8: 'Source auto caption' }],
    })
    const runCommand: CommandRunner = async (command, args) => {
      calls.push({ command, args })
      if (args.includes('--print')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            duration: 20,
            language: 'yue',
            subtitles: {},
          }),
          stderr: '',
        }
      }
      if (args.includes('yue')) {
        const outputTemplate = args[args.indexOf('--output') + 1]
        await writeFile(
          outputTemplate.replace('%(ext)s', 'yue.json3'),
          captions,
        )
      }
      return { exitCode: 0, stdout: '', stderr: '' }
    }
    const testServer = await startServer({
      tempRoot,
      ytDlpPath: 'fake-ytdlp',
      runCommand,
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-captions/${VIDEO_ID}`,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        status: 'available',
        language: 'yue',
        automatic: true,
      })
      expect(calls).toHaveLength(3)
      expect(calls[1].args).toContain('yue-orig')
      expect(calls[2].args).toContain('yue')
    } finally {
      await testServer.close()
    }
  })

  it('returns unavailable when no selected caption file exists', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const runCommand: CommandRunner = async (command, args) => {
      calls.push({ command, args })
      return args.includes('--print')
        ? {
            exitCode: 0,
            stdout: JSON.stringify({
              duration: 30,
              language: 'en',
              subtitles: {},
            }),
            stderr: '',
          }
        : { exitCode: 0, stdout: '', stderr: '' }
    }
    const testServer = await startServer({
      tempRoot,
      ytDlpPath: 'fake-ytdlp',
      runCommand,
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-captions/${VIDEO_ID}`,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        status: 'unavailable',
        language: null,
        automatic: false,
        cues: [],
      })
      expect(calls).toHaveLength(3)
      expect(calls[1].args).toContain('en-orig')
      expect(calls[2].args).toContain('en')
      expect(await readdir(tempRoot)).toEqual([])
    } finally {
      await testServer.close()
    }
  })

  it('returns unavailable for a valid but empty caption document', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const testServer = await startServer({
      tempRoot,
      ytDlpPath: 'fake-ytdlp',
      runCommand: successfulRunner(
        calls,
        {
          duration: 30,
          language: 'en',
          subtitles: { en: [{ ext: 'json3' }] },
        },
        json3({
          tStartMs: 1_000,
          dDurationMs: 1_000,
          segs: [{ utf8: '  ' }],
        }),
      ),
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-captions/${VIDEO_ID}`,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        status: 'unavailable',
        language: null,
        automatic: false,
        cues: [],
      })
    } finally {
      await testServer.close()
    }
  })

  it('rejects unsupported long videos without attempting a subtitle download', async () => {
    const tempRoot = await createTempRoot()
    const calls: CommandCall[] = []
    const testServer = await startServer({
      tempRoot,
      ytDlpPath: 'fake-ytdlp',
      runCommand: successfulRunner(calls, {
        duration: 601,
        subtitles: {},
      }),
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-captions/${VIDEO_ID}`,
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

  it('aborts timed-out work and cleans up its temporary directory', async () => {
    const tempRoot = await createTempRoot()
    let commandWasAborted = false
    const runCommand: CommandRunner = async (_command, _args, options) =>
      new Promise((resolve) => {
        options.signal.addEventListener(
          'abort',
          () => {
            commandWasAborted = true
            resolve({ exitCode: 1, stdout: '', stderr: '' })
          },
          { once: true },
        )
      })
    const testServer = await startServer({
      tempRoot,
      ytDlpPath: 'fake-ytdlp',
      timeoutMs: 10,
      runCommand,
    })

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/youtube-captions/${VIDEO_ID}`,
      )
      expect(response.status).toBe(504)
      expect(await response.json()).toMatchObject({
        error: { code: 'REQUEST_TIMEOUT', retryable: true },
      })
      expect(commandWasAborted).toBe(true)
      expect(await readdir(tempRoot)).toEqual([])
    } finally {
      await testServer.close()
    }
  })
})
