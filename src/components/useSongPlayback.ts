import { useEffect, useMemo, useRef, useState } from 'react'
import { loadYouTubeAudio } from '../audio/youtubeAnalysis'
import { useYouTubeClock, type VideoClock } from './useYouTubeClock'

/** How long the embedded player may stay silent once analysis is done. */
const PLAYER_GRACE_MS = 8_000

/** Why the song audio is playing instead of the embedded video. */
export type VideoProblem = 'blocked' | 'silent' | null

export type PlaybackSource =
  | {
      kind: 'youtube'
      videoId: string
      audio: Blob | null
      verifiedAudioRequired: boolean
    }
  | { kind: 'upload'; identity: string; audio: Blob | null }

/** One playback clock keeps lyrics, notes and seeking together across both sources. */
export function useSongPlayback(
  source: PlaybackSource | null,
  analyzing: boolean,
  guitarAudio?: Blob,
) {
  const [hearGuitar, setHearGuitar] = useState(false)
  const [guitarUrl, setGuitarUrl] = useState<string | null>(null)
  const pendingSwitch = useRef<{
    time: number
    playing: boolean
    rate: number
  } | null>(null)
  useEffect(() => {
    setHearGuitar(false)
    if (!guitarAudio) {
      setGuitarUrl(null)
      return
    }
    const url = URL.createObjectURL(guitarAudio)
    setGuitarUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [guitarAudio])
  const videoId = source?.kind === 'youtube' ? source.videoId : null
  const suppliedAudio = source?.audio ?? null
  const upload = source?.kind === 'upload'
  const verifiedAudioRequired =
    source?.kind === 'youtube' && source.verifiedAudioRequired
  const identity = upload ? source.identity : videoId
  const hasSource = source !== null
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const video = useYouTubeClock(iframeRef, Boolean(videoId))
  const [preferAudio, setPreferAudio] = useState(false)
  const [stalled, setStalled] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const useAudio =
    verifiedAudioRequired ||
    upload ||
    suppliedAudio !== null ||
    preferAudio ||
    stalled ||
    video.error !== null
  const pauseVideo = video.pause

  useEffect(() => {
    setPreferAudio(false)
    setStalled(false)
  }, [identity])

  // YouTube does not always report an error for a video it will not play
  // here (label uploads on local addresses, player messages eaten by an
  // extension). Once the song audio exists, give the player a moment and then
  // play the audio instead of leaving the transport disabled. A slow player
  // that reports ready later can be shown again with showVideo.
  useEffect(() => {
    if (!videoId || analyzing || useAudio || video.ready) return
    const timer = window.setTimeout(() => setStalled(true), PLAYER_GRACE_MS)
    return () => window.clearTimeout(timer)
  }, [videoId, analyzing, useAudio, video.ready])

  useEffect(() => {
    if (!useAudio) return
    pauseVideo()
  }, [useAudio, pauseVideo])

  useEffect(() => {
    if (!useAudio || analyzing || !hasSource) return
    // A retry reloads the original song; the preview choice must not keep the old element.
    setHearGuitar(false)
    pendingSwitch.current = null
    setAudioUrl(null)
    setAudioError(null)
    setAudioReady(false)
    setPlaying(false)
    if (suppliedAudio) {
      const url = URL.createObjectURL(suppliedAudio)
      setAudioUrl(url)
      const element = audioRef.current
      return () => {
        element?.pause()
        URL.revokeObjectURL(url)
        setAudioUrl(null)
        setAudioReady(false)
        setPlaying(false)
      }
    }
    if (upload || verifiedAudioRequired) {
      setAudioError(
        upload
          ? 'Reattach your recording below to verify and restore playback.'
          : 'Analyze this video again to verify its audio before playback.',
      )
      return
    }
    if (!videoId) return
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
  }, [
    videoId,
    identity,
    useAudio,
    analyzing,
    attempt,
    suppliedAudio,
    upload,
    verifiedAudioRequired,
    hasSource,
  ])

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
    audioUrl: hearGuitar ? guitarUrl : audioUrl,
    hearGuitar,
    hasGuitar: guitarUrl !== null,
    switchAudio: (guitar: boolean) => {
      const element = audioRef.current
      if (!element || guitar === hearGuitar) return
      // Keep the first pending position: a second switch before metadata loads would read 0.
      pendingSwitch.current ??= {
        time: element.currentTime,
        playing: !element.paused,
        rate: element.playbackRate,
      }
      setHearGuitar(guitar)
    },
    restoreAudioPosition: () => {
      const pending = pendingSwitch.current
      const element = audioRef.current
      if (!pending || !element) return
      element.currentTime = pending.time
      element.playbackRate = pending.rate
      pendingSwitch.current = null
      // Browsers need not emit pause when replacing an already-paused source.
      setPlaying(pending.playing)
      if (pending.playing)
        void element.play().catch(() => {
          setPlaying(false)
          setAudioError('Press play to resume playback.')
        })
    },
    audioError,
    useAudio,
    videoProblem: (video.error !== null
      ? 'blocked'
      : stalled
        ? 'silent'
        : null) satisfies VideoProblem,
    ready: useAudio ? audioReady : video.ready,
    /** The embedded player has reported in, so a 'silent' stall can be undone. */
    videoReady: video.ready,
    clock: useAudio ? audio : video,
    setPlaying,
    setAudioReady,
    setAudioError,
    chooseAudio: () => {
      video.pause()
      setPreferAudio(true)
    },
    retryAudio: () => setAttempt((value) => value + 1),
    showVideo: () => setStalled(false),
  }
}
