import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createYouTubeLyricsMiddleware,
  parseSyncedLyrics,
  type YouTubeLyricsMiddlewareOptions,
} from './lyrics.ts'
import type { CommandRunner } from './youtube.ts'

interface TestServer {
  baseUrl: string
  close: () => Promise<void>
}

interface CommandCall {
  command: string
  args: readonly string[]
}

const VIDEO_ID = '3VoWqGhLvF8'
const openServers: TestServer[] = []

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((server) => server.close()))
})

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

async function startServer(
  options: YouTubeLyricsMiddlewareOptions,
): Promise<TestServer> {
  const middleware = createYouTubeLyricsMiddleware(options)
  const server = createServer((request, response) => {
    middleware(request, response, () => response.writeHead(404).end('next'))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind')
  }

  const testServer = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server),
  }
  openServers.push(testServer)
  return testServer
}

function metadataRunner(
  calls: CommandCall[],
  metadata: Record<string, unknown> = {
    track: 'I Saw the Light',
    artist: 'Hank Williams',
    album: 'The Legend Hank Williams',
    duration: 164,
    is_live: false,
    live_status: 'not_live',
  },
): CommandRunner {
  return async (command, args) => {
    calls.push({ command, args })
    return { exitCode: 0, stdout: JSON.stringify(metadata), stderr: '' }
  }
}

function lrclibResponse(
  overrides: Record<string, unknown> = {},
  init?: ResponseInit,
): Response {
  return new Response(
    JSON.stringify({
      id: 6729,
      trackName: 'I Saw the Light',
      artistName: 'Hank Williams',
      albumName: 'Gospel Favorites',
      duration: 165,
      instrumental: false,
      plainLyrics: 'Untimed words are ignored by the middleware',
      syncedLyrics: '[00:01.00] First line\n[00:03.00]\n[00:05.50] Second line',
      ...overrides,
    }),
    { status: 200, ...init },
  )
}

describe('parseSyncedLyrics', () => {
  it('uses explicit timestamps and empty markers without inventing timing', () => {
    expect(
      parseSyncedLyrics(
        '[ar:Artist]\n[00:01.00] First line\n[00:03.00]\n[00:05.50] Second <00:05.60>line',
        10,
      ),
    ).toEqual([
      { start: 1, end: 3, text: 'First line' },
      { start: 5.5, end: 10, text: 'Second line' },
    ])
  })

  it('rejects mixed, duplicate, invalid, and recording-incompatible timing', () => {
    for (const lyrics of [
      '[00:01]Timed\nUntimed',
      '[00:01]One\n[00:01]Two',
      '[00:99]Invalid',
      '[00:13]Past recording',
      '[offset:5000]\n[00:01]Negative',
    ]) {
      expect(parseSyncedLyrics(lyrics, 10)).toBeNull()
    }
  })

  it('returns no cues for empty or metadata-only input', () => {
    expect(parseSyncedLyrics('', 10)).toBeNull()
    expect(parseSyncedLyrics('[ar:Artist]\n[ti:Track]', 10)).toBeNull()
  })
})

describe('createYouTubeLyricsMiddleware', () => {
  it('passes unrelated routes through and rejects malformed IDs before work', async () => {
    const runCommand = vi.fn<CommandRunner>()
    const fetchImpl = vi.fn<typeof fetch>()
    const server = await startServer({ runCommand, fetchImpl })

    const unrelated = await fetch(`${server.baseUrl}/health`)
    expect(unrelated.status).toBe(404)
    expect(await unrelated.text()).toBe('next')

    const invalid = await fetch(
      `${server.baseUrl}/api/youtube-lyrics/not-a-video-id`,
    )
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({
      error: {
        code: 'INVALID_VIDEO_ID',
        message: 'Provide a valid 11-character YouTube video ID.',
      },
    })
    expect(runCommand).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns synced lyrics only after exact identity and duration validation', async () => {
    const calls: CommandCall[] = []
    const fetchImpl = vi.fn<typeof fetch>(async () => lrclibResponse())
    const server = await startServer({
      ytDlpPath: 'fake-ytdlp',
      runCommand: metadataRunner(calls),
      fetchImpl,
    })

    const response = await fetch(
      `${server.baseUrl}/api/youtube-lyrics/${VIDEO_ID}?ignored=1`,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'available',
      language: null,
      automatic: false,
      cues: [
        { start: 1, end: 3, text: 'First line' },
        { start: 5.5, end: 164, text: 'Second line' },
      ],
      source: 'lyrics',
      attribution: { name: 'LRCLIB', url: 'https://lrclib.net' },
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].command).toBe('fake-ytdlp')
    expect(calls[0].args).toContain('--no-cookies')
    expect(calls[0].args.at(-1)).toBe(
      `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    )
    const [requestUrl, requestInit] = fetchImpl.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.origin + url.pathname).toBe('https://lrclib.net/api/get')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      track_name: 'I Saw the Light',
      artist_name: 'Hank Williams',
      duration: '164',
    })
    expect(url.searchParams.has('album_name')).toBe(false)
    expect(requestInit?.headers).toMatchObject({
      Accept: 'application/json',
      'User-Agent': expect.stringContaining('FretBloom'),
    })
  })

  it.each([
    ['track title', { trackName: 'I Saw a Light' }],
    ['artist', { artistName: 'Another Artist' }],
    ['duration', { duration: 167 }],
  ])(
    'rejects a mismatched %s instead of accepting another recording',
    async (_label, override) => {
      const calls: CommandCall[] = []
      const server = await startServer({
        runCommand: metadataRunner(calls),
        fetchImpl: async () => lrclibResponse(override),
      })

      const response = await fetch(
        `${server.baseUrl}/api/youtube-lyrics/${VIDEO_ID}`,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        status: 'unavailable',
        cues: [],
        source: 'lyrics',
      })
    },
  )

  it('does not guess title or artist from a generic YouTube title', async () => {
    const calls: CommandCall[] = []
    const fetchImpl = vi.fn<typeof fetch>()
    const server = await startServer({
      runCommand: metadataRunner(calls, {
        title: 'Hank Williams - I Saw the Light (Official Audio)',
        duration: 164,
      }),
      fetchImpl,
    })

    const response = await fetch(
      `${server.baseUrl}/api/youtube-lyrics/${VIDEO_ID}`,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'unavailable',
      cues: [],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('treats LRCLIB 404 and records without synced lyrics as unavailable', async () => {
    const calls: CommandCall[] = []
    const notFoundServer = await startServer({
      runCommand: metadataRunner(calls),
      fetchImpl: async () =>
        new Response(JSON.stringify({ name: 'TrackNotFound' }), {
          status: 404,
        }),
    })
    const notFound = await fetch(
      `${notFoundServer.baseUrl}/api/youtube-lyrics/${VIDEO_ID}`,
    )
    expect(notFound.status).toBe(200)
    expect(await notFound.json()).toMatchObject({ status: 'unavailable' })

    const plainOnlyServer = await startServer({
      runCommand: metadataRunner(calls),
      fetchImpl: async () => lrclibResponse({ syncedLyrics: null }),
    })
    const plainOnly = await fetch(
      `${plainOnlyServer.baseUrl}/api/youtube-lyrics/${VIDEO_ID}`,
    )
    expect(plainOnly.status).toBe(200)
    expect(await plainOnly.json()).toMatchObject({ status: 'unavailable' })
  })

  it('surfaces upstream rate limits without exposing the response body', async () => {
    const calls: CommandCall[] = []
    const server = await startServer({
      runCommand: metadataRunner(calls),
      fetchImpl: async () =>
        new Response('upstream details', {
          status: 429,
          headers: { 'Retry-After': '120' },
        }),
    })

    const response = await fetch(
      `${server.baseUrl}/api/youtube-lyrics/${VIDEO_ID}`,
    )
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('120')
    expect(await response.json()).toEqual({
      error: {
        code: 'LYRICS_RATE_LIMITED',
        message:
          'The synced lyrics service is temporarily rate-limited. Try again later.',
        retryable: true,
      },
    })
  })

  it('rejects oversized upstream responses before parsing them', async () => {
    const calls: CommandCall[] = []
    const server = await startServer({
      maxResponseBytes: 20,
      runCommand: metadataRunner(calls),
      fetchImpl: async () => lrclibResponse(),
    })

    const response = await fetch(
      `${server.baseUrl}/api/youtube-lyrics/${VIDEO_ID}`,
    )
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({
      error: { code: 'LYRICS_RESPONSE_TOO_LARGE' },
    })
  })

  it('aborts an in-flight LRCLIB request on timeout', async () => {
    const calls: CommandCall[] = []
    let requestWasAborted = false
    const fetchImpl: typeof fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            requestWasAborted = true
            reject(init.signal?.reason)
          },
          { once: true },
        )
      })
    const server = await startServer({
      timeoutMs: 10,
      runCommand: metadataRunner(calls),
      fetchImpl,
    })

    const response = await fetch(
      `${server.baseUrl}/api/youtube-lyrics/${VIDEO_ID}`,
    )
    expect(response.status).toBe(504)
    expect(await response.json()).toMatchObject({
      error: { code: 'REQUEST_TIMEOUT', retryable: true },
    })
    expect(requestWasAborted).toBe(true)
  })

  it('rejects videos beyond the supported duration before LRCLIB lookup', async () => {
    const calls: CommandCall[] = []
    const fetchImpl = vi.fn<typeof fetch>()
    const server = await startServer({
      runCommand: metadataRunner(calls, {
        track: 'Long Song',
        artist: 'Artist',
        duration: 601,
      }),
      fetchImpl,
    })

    const response = await fetch(
      `${server.baseUrl}/api/youtube-lyrics/${VIDEO_ID}`,
    )
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({
      error: { code: 'VIDEO_TOO_LONG' },
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
