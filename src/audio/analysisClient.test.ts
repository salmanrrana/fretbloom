import { afterEach, expect, test, vi } from 'vitest'
import {
  analyzeUploadedAudio,
  analyzeYouTubeAudio,
  boundedBody,
} from './analysisClient'
import { DEFAULT_OPTIONS, MAX_SOURCE_BYTES } from './analysisV1'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const id = '00000000-0000-4000-8000-000000000001'
const file = new File(['wav'], 'recording.wav', { type: 'audio/wav' })
const source = {
  kind: 'upload',
  name: file.name,
  byteLength: file.size,
  contentType: file.type,
}
const job = {
  schemaVersion: 1,
  id,
  source,
  options: DEFAULT_OPTIONS,
  createdAt: '2026-10-31T12:00:00Z',
  expiresAt: '2026-10-31T12:30:00Z',
  status: 'awaiting_upload',
  progress: { stage: 'uploading', fraction: null },
  error: null,
}
const analysis = {
  schemaVersion: 1,
  engineVersion: 'rust-dsp-1',
  options: DEFAULT_OPTIONS,
  duration: 1,
  sampleRateHz: 24000,
  timingResolutionSeconds: 0.02,
  tuning: { referenceHz: 440, estimatedOffsetCents: null },
  harmony: [],
  monophonicNotes: [],
  polyphonicNotes: [],
  warnings: [],
}
function backend(resultEngine = 'rust-dsp-1') {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (init?.method === 'DELETE')
      return Response.json({ ...job, status: 'canceled' })
    if (path.endsWith('/capabilities'))
      return Response.json({
        schemaVersion: 1,
        engineVersion: 'rust-dsp-1',
        modes: ['auto'],
        qualities: ['maj'],
        limits: { maxSourceBytes: MAX_SOURCE_BYTES, maxDurationSeconds: 600 },
        uploads: true,
        youtube: true,
      })
    if (path.endsWith('/result'))
      return Response.json({
        schemaVersion: 1,
        jobId: id,
        source,
        title: null,
        pcmSha256: 'a'.repeat(64),
        focus: 'full_mix',
        analyzedAudio: { kind: 'full_mix', pcmSha256: 'a'.repeat(64) },
        analysis: { ...analysis, engineVersion: resultEngine },
      })
    if (path.endsWith('/features'))
      return Response.json({
        schemaVersion: 1,
        engineVersion: 'rust-dsp-1',
        duration: 1,
        hopSeconds: 0.08,
        frames: [],
      })
    if (path.endsWith('/audio'))
      return new Response('wav', { headers: { 'Content-Type': 'audio/wav' } })
    return Response.json(
      init?.method === 'POST' ? job : { ...job, status: 'succeeded' },
    )
  })
}
test('upload returns validated real-route artifacts and removes the temporary job', async () => {
  const fetcher = backend()
  vi.stubGlobal('fetch', fetcher)
  const statuses: string[] = []
  const output = await analyzeUploadedAudio(file, DEFAULT_OPTIONS, {
    signal: new AbortController().signal,
    onStatus: (j) => statuses.push(j.status),
  })
  expect(statuses).toEqual(['awaiting_upload', 'succeeded'])
  expect(output.audio.size).toBe(3)
  expect(
    fetcher.mock.calls.find(([, init]) => init?.method === 'PUT')?.[1]?.body,
  ).toBe(file)
  expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe('DELETE')
})
test('source replacement abort deletes known jobs with a fresh signal', async () => {
  const fetcher = backend(),
    controller = new AbortController()
  vi.stubGlobal('fetch', fetcher)
  await expect(
    analyzeUploadedAudio(file, DEFAULT_OPTIONS, {
      signal: controller.signal,
      onStatus: () =>
        controller.abort(new DOMException('Replaced', 'AbortError')),
    }),
  ).rejects.toThrow('Replaced')
  const cleanup = fetcher.mock.calls.at(-1)?.[1]
  expect(cleanup?.method).toBe('DELETE')
  expect(cleanup?.signal?.aborted).toBe(false)
})
test('engine mismatches and HTML static hosts fail explicitly', async () => {
  vi.stubGlobal('fetch', backend('other-engine'))
  await expect(
    analyzeUploadedAudio(file, DEFAULT_OPTIONS, {
      signal: new AbortController().signal,
      onStatus: () => {},
    }),
  ).rejects.toThrow('do not match')
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response('<html>', { headers: { 'Content-Type': 'text/html' } }),
  )
  await expect(
    analyzeUploadedAudio(file, DEFAULT_OPTIONS, {
      signal: new AbortController().signal,
      onStatus: () => {},
    }),
  ).rejects.toThrow('unavailable')
})
test('streamed responses cannot bypass size bounds by omitting Content-Length', async () => {
  let canceled = false
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(10))
    },
    cancel() {
      canceled = true
    },
  })
  await expect(boundedBody(new Response(stream), 5)).rejects.toThrow(
    'too large',
  )
  expect(canceled).toBe(true)
})
test('polls nonterminal jobs and backs off retryable failures', async () => {
  vi.useFakeTimers()
  const standard = backend()
  let polls = 0
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/media'))
        return Response.json({ ...job, status: 'queued' })
      if (String(input).endsWith(id) && !init?.method) {
        polls++
        if (polls === 1)
          return Response.json(
            {
              error: {
                code: 'RATE_LIMITED',
                message: 'Try shortly.',
                retryable: true,
              },
            },
            { status: 429 },
          )
        return Response.json({ ...job, status: 'succeeded' })
      }
      return standard(input, init)
    },
  )
  vi.stubGlobal('fetch', fetcher)
  const run = analyzeUploadedAudio(file, DEFAULT_OPTIONS, {
    signal: new AbortController().signal,
    onStatus: () => {},
  })
  await vi.advanceTimersByTimeAsync(6001)
  await expect(run).resolves.toHaveProperty('result')
  expect(polls).toBe(2)
})

test('YouTube uses v1 jobs and propagates provider refusal without browser fallback', async () => {
  vi.useFakeTimers()
  const standard = backend()
  const videoSource = { kind: 'youtube', videoId: 'testaudio01' }
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST')
        return Response.json({ ...job, source: videoSource, status: 'queued' })
      if (String(input).endsWith(id) && !init?.method)
        return Response.json({
          ...job,
          source: videoSource,
          status: 'failed',
          error: {
            code: 'YOUTUBE_UNAVAILABLE',
            message: 'This video cannot be acquired.',
            retryable: false,
          },
        })
      return standard(input, init)
    },
  )
  vi.stubGlobal('fetch', fetcher)
  const run = analyzeYouTubeAudio('testaudio01', DEFAULT_OPTIONS, {
    signal: new AbortController().signal,
    onStatus: () => {},
  })
  const rejected = expect(run).rejects.toThrow('cannot be acquired')
  await vi.advanceTimersByTimeAsync(2001)
  await rejected
  expect(
    fetcher.mock.calls.every(([input]) =>
      String(input).startsWith('/api/analysis/v1/'),
    ),
  ).toBe(true)
  expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(
    false,
  )
  expect(
    JSON.parse(
      String(
        fetcher.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]
          ?.body,
      ),
    ).source,
  ).toEqual(videoSource)
})
