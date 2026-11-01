import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadYouTubeAudio } from './youtubeAnalysis'

afterEach(() => vi.unstubAllGlobals())

describe('Node playback fallback', () => {
  it('returns WAV audio and optional decoded title', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('audio bytes', {
          headers: { 'content-type': 'audio/wav', 'x-video-title': 'A%20song' },
        }),
    )
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    const playback = await loadYouTubeAudio('testaudio01', signal)
    expect(await playback.blob.text()).toBe('audio bytes')
    expect(playback.blob.type).toBe('audio/wav')
    expect(playback.title).toBe('A song')
    expect(fetcher).toHaveBeenCalledWith('/api/youtube-audio/testaudio01', {
      signal,
    })
  })

  it('does not treat an API error page as playable audio', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response('<html>Not audio</html>', {
          headers: { 'content-type': 'text/html' },
        }),
    )
    await expect(
      loadYouTubeAudio('testaudio02', new AbortController().signal),
    ).rejects.toThrow('not available')
  })

  it('preserves server failure messages', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json(
        { error: { message: 'Video unavailable' } },
        { status: 422 },
      ),
    )
    await expect(
      loadYouTubeAudio('testaudio02', new AbortController().signal),
    ).rejects.toThrow('Video unavailable')
  })

  it('refuses an already aborted request before fetching', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()
    controller.abort()
    await expect(
      loadYouTubeAudio('testaudio01', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects abort during a chunked response instead of returning partial audio', async () => {
    const controller = new AbortController()
    let pulls = 0
    const body = new ReadableStream<Uint8Array>(
      {
        pull(stream) {
          if (++pulls === 1) stream.enqueue(new Uint8Array(4))
          else {
            controller.abort()
            // Fetch errors its body when its signal is aborted.
            stream.error(controller.signal.reason)
          }
        },
      },
      { highWaterMark: 0 },
    )
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(body, { headers: { 'content-type': 'audio/wav' } }),
    )
    await expect(
      loadYouTubeAudio('testaudio01', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(pulls).toBe(2)
  })
})

it.each([undefined, '1'])(
  'stops an oversized chunked body even with content-length %s',
  async (length) => {
    const cancel = vi.fn()
    let pulls = 0
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls++
          if (pulls <= 2) controller.enqueue(new Uint8Array(8 * 1024 * 1024))
          else if (pulls === 3) controller.enqueue(new Uint8Array(1))
          else controller.close()
        },
        cancel,
      },
      { highWaterMark: 0 },
    )
    const headers = new Headers({ 'content-type': 'audio/wav' })
    if (length) headers.set('content-length', length)
    vi.stubGlobal('fetch', async () => new Response(body, { headers }))
    await expect(
      loadYouTubeAudio('boundedtest', new AbortController().signal),
    ).rejects.toThrow()
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(pulls).toBe(3)
  },
)
