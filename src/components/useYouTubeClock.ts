import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'

const YT_ORIGIN = 'https://www.youtube-nocookie.com'

export interface VideoClock {
  time: () => number | null
  isPlaying: () => boolean
  playing: boolean
  seek: (seconds: number) => void
  play: () => void
  pause: () => void
  setRate: (rate: number) => void
}

/**
 * The clock's position as state, sampled ten times a second. The player reads
 * it once and hands it down, so every live readout shares one poll.
 */
export function useClockPosition(clock: VideoClock): number {
  const [position, setPosition] = useState(0)
  useEffect(() => {
    const tick = () => {
      const time = clock.time()
      if (time !== null) setPosition(time)
    }
    tick()
    const timer = window.setInterval(tick, 100)
    return () => window.clearInterval(timer)
  }, [clock])
  return position
}

/** Follow only this iframe's reports, interpolating at the video's playback speed. */
export function useYouTubeClock(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  enabled: boolean,
): VideoClock & { ready: boolean; error: number | null } {
  const [error, setError] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(false)
  const lastTime = useRef<number | null>(null)
  const lastAt = useRef(0)
  const rate = useRef(1)

  const time = useCallback(
    () =>
      lastTime.current === null
        ? null
        : lastTime.current +
          (playingRef.current
            ? ((performance.now() - lastAt.current) / 1000) * rate.current
            : 0),
    [],
  )
  const command = useCallback(
    (func: string, args: unknown[] = []) => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          event: 'command',
          func,
          args,
          id: 1,
          channel: 'widget',
        }),
        YT_ORIGIN,
      )
    },
    [iframeRef],
  )

  useEffect(() => {
    const reset = () => {
      setError(null)
      setReady(false)
      lastTime.current = null
      playingRef.current = false
      rate.current = 1
      setPlaying(false)
    }
    reset()
    if (!enabled) return
    let gotInfo = false
    const listen = () => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
        YT_ORIGIN,
      )
      command('addEventListener', ['onError'])
      command('addEventListener', ['onStateChange'])
    }
    const onLoad = () => {
      reset()
      gotInfo = false
      listen()
    }
    const onMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== YT_ORIGIN ||
        event.source !== iframeRef.current?.contentWindow
      )
        return
      let data: unknown
      try {
        data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (data && typeof data === 'object' && 'event' in data) {
        if (data.event === 'onReady') {
          setReady(true)
          listen()
          return
        }
        if (
          data.event === 'onError' &&
          'info' in data &&
          typeof data.info === 'number'
        ) {
          setError(data.info)
          playingRef.current = false
          setPlaying(false)
          return
        }
      }
      if (
        !data ||
        typeof data !== 'object' ||
        !('event' in data) ||
        (data.event !== 'infoDelivery' && data.event !== 'initialDelivery') ||
        !('info' in data) ||
        !data.info ||
        typeof data.info !== 'object'
      )
        return
      const info = data.info
      const current = time()
      if (current !== null) lastTime.current = current
      lastAt.current = performance.now()
      if (
        'currentTime' in info &&
        typeof info.currentTime === 'number' &&
        Number.isFinite(info.currentTime) &&
        info.currentTime >= 0
      ) {
        lastTime.current = info.currentTime
        gotInfo = true
        setReady(true)
      }
      if (
        'playbackRate' in info &&
        typeof info.playbackRate === 'number' &&
        Number.isFinite(info.playbackRate) &&
        info.playbackRate > 0
      )
        rate.current = info.playbackRate
      if ('playerState' in info && typeof info.playerState === 'number') {
        playingRef.current = info.playerState === 1
        setPlaying(playingRef.current)
      }
    }
    const iframe = iframeRef.current
    iframe?.addEventListener('load', onLoad)
    window.addEventListener('message', onMessage)
    listen()
    const knock = window.setInterval(() => {
      if (!gotInfo) listen()
    }, 700)
    return () => {
      iframe?.removeEventListener('load', onLoad)
      window.removeEventListener('message', onMessage)
      window.clearInterval(knock)
    }
  }, [enabled, iframeRef, time, command])

  return useMemo(
    () => ({
      time,
      ready,
      error,
      isPlaying: () => playingRef.current,
      playing,
      seek: (seconds: number) => {
        if (!Number.isFinite(seconds) || seconds < 0) return
        lastTime.current = seconds
        lastAt.current = performance.now()
        command('seekTo', [seconds, true])
      },
      play: () => command('playVideo'),
      pause: () => command('pauseVideo'),
      setRate: (value: number) => command('setPlaybackRate', [value]),
    }),
    [playing, command, time, ready, error],
  )
}
