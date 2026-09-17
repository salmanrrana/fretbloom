import { useEffect, useMemo, useRef, useState } from 'react'
import { loadYouTubeAudio } from '../audio/youtubeAnalysis'
import { useYouTubeClock, type VideoClock } from './useYouTubeClock'

/** One playback clock keeps lyrics, notes and seeking together across both sources. */
export function useSongPlayback(videoId: string | null, analyzing: boolean) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const video = useYouTubeClock(iframeRef, Boolean(videoId))
  const [preferAudio, setPreferAudio] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const useAudio = preferAudio || video.error !== null
  const pauseVideo = video.pause

  useEffect(() => {
    if (!useAudio) return
    pauseVideo()
  }, [useAudio, pauseVideo])

  useEffect(() => {
    if (!videoId || !useAudio || analyzing) return
    const controller = new AbortController()
    let objectUrl: string | null = null
    setAudioError(null)
    setAudioReady(false)
    const timeout = window.setTimeout(
      () => controller.abort('timeout'),
      180_000,
    )
    void loadYouTubeAudio(videoId, controller.signal)
      .then(({ blob }) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setAudioUrl(objectUrl)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted && controller.signal.reason !== 'timeout')
          return
        setAudioError(
          error instanceof Error
            ? error.message
            : 'The song audio could not be loaded. Try again.',
        )
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setAudioUrl(null)
      setAudioReady(false)
      setPlaying(false)
    }
  }, [videoId, useAudio, analyzing, attempt])

  const audio: VideoClock = useMemo(
    () => ({
      time: () =>
        audioRef.current && audioRef.current.readyState >= 1
          ? audioRef.current.currentTime
          : null,
      isPlaying: () =>
        Boolean(
          audioRef.current &&
          !audioRef.current.paused &&
          !audioRef.current.ended,
        ),
      playing,
      seek: (seconds) => {
        const element = audioRef.current
        if (element && element.readyState >= 1 && Number.isFinite(seconds))
          element.currentTime = Math.max(
            0,
            Math.min(seconds, element.duration || seconds),
          )
      },
      play: () => {
        void audioRef.current
          ?.play()
          .catch(() =>
            setAudioError('Playback could not start. Press play to try again.'),
          )
      },
      pause: () => audioRef.current?.pause(),
      setRate: (rate) => {
        if (
          audioRef.current &&
          Number.isFinite(rate) &&
          rate >= 0.25 &&
          rate <= 2
        )
          audioRef.current.playbackRate = rate
      },
    }),
    [playing],
  )

  return {
    iframeRef,
    audioRef,
    audioUrl,
    audioError,
    useAudio,
    videoError: video.error,
    ready: useAudio ? audioReady : video.ready,
    clock: useAudio ? audio : video,
    setPlaying,
    setAudioReady,
    setAudioError,
    chooseAudio: () => {
      video.pause()
      setPreferAudio(true)
    },
    retryAudio: () => setAttempt((value) => value + 1),
  }
}
