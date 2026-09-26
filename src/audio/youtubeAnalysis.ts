import { analyzeSongFile } from './songAnalysis'
import type { SongAnalysis } from './songAnalysisTypes'

export interface YouTubeAnalysisResult {
  analysis: SongAnalysis
  title: string | null
  audio: Blob
}

// Keep at most two recordings in memory for analysis and in-page playback.
// Audio is never persisted in the songbook.
const cache = new Map<string, YouTubeAnalysisResult>()

export async function analyzeYouTube(
  videoId: string,
  {
    signal,
    onProgress,
    onAnalyzing,
  }: {
    signal: AbortSignal
    onProgress: (progress: number) => void
    onAnalyzing: () => void
  },
): Promise<YouTubeAnalysisResult> {
  if (!/^[\w-]{11}$/.test(videoId))
    throw new Error('Enter a valid YouTube link.')
  const cached = cache.get(videoId)
  if (cached) {
    signal.throwIfAborted()
    return cached
  }
  const { blob, title } = await loadYouTubeAudio(videoId, signal)
  onAnalyzing()
  const analysis = await analyzeSongFile(
    new File([blob], `${videoId}.wav`, { type: 'audio/wav' }),
    { signal, onProgress },
  )
  signal.throwIfAborted()
  const result = { analysis, title, audio: blob }
  if (cache.size >= 2) cache.delete(cache.keys().next().value!)
  cache.set(videoId, result)
  return result
}

/** Share the analyzed recording with playback; reopened songs fetch it on demand. */
export async function loadYouTubeAudio(
  videoId: string,
  signal: AbortSignal,
): Promise<{ blob: Blob; title: string | null }> {
  if (!/^[\w-]{11}$/.test(videoId))
    throw new Error('Enter a valid YouTube link.')
  const cached = cache.get(videoId)
  if (cached) {
    signal.throwIfAborted()
    return { blob: cached.audio, title: cached.title }
  }
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
    throw new Error(
      'Automatic YouTube analysis is not available on this server yet.',
    )
  }
  const blob = await response.blob()
  signal.throwIfAborted()
  if (blob.size > 16 * 1024 * 1024)
    throw new Error(
      'This video is too long to analyze. Choose one under 10 minutes.',
    )
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
