import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('./songAnalysis', () => ({
  analyzeSongFile: vi.fn(async () => ({
    duration: 3,
    hopSeconds: 0.1,
    frames: [],
    notes: [],
  })),
}))
import { analyzeYouTube, loadYouTubeAudio } from './youtubeAnalysis'

afterEach(() => vi.unstubAllGlobals())
describe('song audio shared with playback', () => {
  it('reuses the analyzed audio for playback without another request', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(new Blob(['audio bytes']), {
          headers: { 'content-type': 'audio/wav', 'x-video-title': 'A%20song' },
        }),
    )
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    const result = await analyzeYouTube('testaudio01', {
      signal,
      onProgress: () => {},
      onAnalyzing: () => {},
    })
    const playback = await loadYouTubeAudio('testaudio01', signal)
    expect(playback.blob).toBe(result.audio)
    expect(playback.title).toBe('A song')
    expect(fetcher).toHaveBeenCalledTimes(1)
    const aborted = new AbortController()
    aborted.abort()
    await expect(
      loadYouTubeAudio('testaudio01', aborted.signal),
    ).rejects.toThrow()
  })
  it('does not treat an API error page as playable audio', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html>Not audio</html>', {
            headers: { 'content-type': 'text/html' },
          }),
      ),
    )
    await expect(
      loadYouTubeAudio('testaudio02', new AbortController().signal),
    ).rejects.toThrow('not available')
  })
})
