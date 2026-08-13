import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * Talks to the songbook's YouTube embed over the iframe postMessage API
 * (enablejsapi=1) — no SDK download. After a "listening" handshake the player
 * streams infoDelivery messages with currentTime/playerState; we interpolate
 * between reports so time() is smooth at rAF rate.
 */

const YT_ORIGIN = 'https://www.youtube-nocookie.com'

export interface VideoClock {
  /** Interpolated playback position in seconds, or null before the first report. */
  time: () => number | null
  /** Ref-backed so rAF loops never read a stale value. */
  isPlaying: () => boolean
  /** React state mirror of isPlaying, for rendering. */
  playing: boolean
  seek: (seconds: number) => void
  play: () => void
  pause: () => void
}

export function useYouTubeClock(iframeRef: RefObject<HTMLIFrameElement | null>, enabled: boolean): VideoClock {
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(false)
  const lastTime = useRef<number | null>(null)
  const lastAt = useRef(0)
  const gotInfo = useRef(false)

  const command = useCallback(
    (func: string, args: unknown[] = []) => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' }),
        YT_ORIGIN,
      )
    },
    [iframeRef],
  )

  useEffect(() => {
    if (!enabled) return

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== YT_ORIGIN) return
      let data: { event?: string; info?: { currentTime?: number; playerState?: number } }
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      } catch {
        return
      }
      if (data.event !== 'infoDelivery' && data.event !== 'initialDelivery') return
      gotInfo.current = true
      const info = data.info
      if (typeof info?.currentTime === 'number') {
        lastTime.current = info.currentTime
        lastAt.current = performance.now()
      }
      if (typeof info?.playerState === 'number') {
        const isPlaying = info.playerState === 1
        playingRef.current = isPlaying
        setPlaying(isPlaying)
      }
    }
    window.addEventListener('message', onMessage)

    // Keep knocking until the player answers (it may still be loading).
    const listen = () => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
        YT_ORIGIN,
      )
    }
    listen()
    const knock = window.setInterval(() => {
      if (gotInfo.current) window.clearInterval(knock)
      else listen()
    }, 700)

    return () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(knock)
    }
  }, [enabled, iframeRef])

  return useMemo(
    () => ({
      time: () => {
        if (lastTime.current == null) return null
        const drift = playingRef.current ? (performance.now() - lastAt.current) / 1000 : 0
        return lastTime.current + drift
      },
      isPlaying: () => playingRef.current,
      playing,
      seek: (seconds: number) => command('seekTo', [seconds, true]),
      play: () => command('playVideo'),
      pause: () => command('pauseVideo'),
    }),
    [playing, command],
  )
}
