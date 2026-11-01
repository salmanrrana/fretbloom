import { boundedBody } from './analysisClient'

/** Node-only playback fallback; Rust analysis supplies its own canonical audio. */
export async function loadYouTubeAudio(
  videoId: string,
  signal: AbortSignal,
): Promise<{ blob: Blob; title: string | null }> {
  if (!/^[\w-]{11}$/.test(videoId))
    throw new Error('Enter a valid YouTube link.')
  signal.throwIfAborted()
  const response = await fetch(`/api/youtube-audio/${videoId}`, { signal })
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok) {
    let message = 'YouTube could not be analyzed right now. Try again shortly.'
    if (contentType.includes('application/json')) {
      const data: unknown = await response.json()
      if (
        data &&
        typeof data === 'object' &&
        'error' in data &&
        data.error &&
        typeof data.error === 'object' &&
        'message' in data.error &&
        typeof data.error.message === 'string'
      )
        message = data.error.message
    }
    throw new Error(message)
  }
  if (!contentType.includes('audio/wav')) {
    await response.body?.cancel()
    throw new Error(
      'Automatic YouTube analysis is not available on this server yet.',
    )
  }
  const bytes = await boundedBody(response, 16 * 1024 * 1024)
  signal.throwIfAborted()
  const blob = new Blob([bytes], { type: 'audio/wav' })
  let title: string | null = null
  const encodedTitle = response.headers.get('x-video-title')
  if (encodedTitle) {
    try {
      title = decodeURIComponent(encodedTitle).slice(0, 200)
    } catch {
      /* Optional metadata cannot prevent analysis. */
    }
  }
  return { blob, title }
}
