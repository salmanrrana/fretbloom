import { useEffect, useRef, useState } from 'react'
import { useYouTubeClock } from './useYouTubeClock'
import type { RuntimeEvent } from '../audio/live/protocol'
import type { VideoAnchor } from '../data/listeningSessions'

const ORIGIN = 'https://www.youtube-nocookie.com'
export function youtubeVideoId(text: string): string | null {
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text
  try {
    const url = new URL(text)
    const id =
      url.hostname === 'youtu.be'
        ? url.pathname.slice(1)
        : [
              'www.youtube.com',
              'youtube.com',
              'www.youtube-nocookie.com',
            ].includes(url.hostname)
          ? (url.searchParams.get('v') ??
            url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1])
          : null
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}
export function LiveVideo({
  capturePosition,
  anchors,
  onRemoveAnchor,
  capturing,
  onAnchor,
  onBreak,
}: {
  capturePosition: Extract<RuntimeEvent, { type: 'status' }>['capturePosition']
  anchors: VideoAnchor[]
  onRemoveAnchor: (index: number) => void
  capturing: boolean
  onAnchor: (anchor: VideoAnchor) => void
  onBreak: () => void
}) {
  const [input, setInput] = useState(
    () =>
      youtubeVideoId(
        new URLSearchParams(window.location.search).get('video') ?? '',
      ) ?? '',
  )
  const [videoId, setVideoId] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [linked, setLinked] = useState<VideoAnchor | null>(null)
  const [message, setMessage] = useState(
    'Optional. Video opens only when you choose Open video.',
  )
  const [offset, setOffset] = useState(0)
  const iframe = useRef<HTMLIFrameElement>(null)
  const clock = useYouTubeClock(iframe, videoId !== null)
  const rate = useRef(1)
  const lastRawClockAt = useRef(0)
  const lastClock = useRef<{ time: number; at: number } | null>(null)
  const invalidate = useRef((reason: string) => {
    setLinked(null)
    setMessage(reason)
  })
  useEffect(() => {
    if (!videoId) return
    const observe = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== ORIGIN ||
        event.source !== iframe.current?.contentWindow
      )
        return
      let value: unknown
      try {
        value =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (
        !value ||
        typeof value !== 'object' ||
        !('info' in value) ||
        !value.info ||
        typeof value.info !== 'object'
      )
        return
      if (
        'playbackRate' in value.info &&
        typeof value.info.playbackRate === 'number' &&
        Number.isFinite(value.info.playbackRate) &&
        value.info.playbackRate >= 0.25 &&
        value.info.playbackRate <= 2
      )
        rate.current = value.info.playbackRate
      if (
        'currentTime' in value.info &&
        typeof value.info.currentTime === 'number' &&
        Number.isFinite(value.info.currentTime)
      )
        lastRawClockAt.current = performance.now()
    }
    window.addEventListener('message', observe)
    return () => window.removeEventListener('message', observe)
  }, [videoId])
  useEffect(() => {
    if (!linked) return
    const onMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== ORIGIN ||
        event.source !== iframe.current?.contentWindow
      )
        return
      let raw: unknown
      try {
        raw =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (
        !raw ||
        typeof raw !== 'object' ||
        !('info' in raw) ||
        !raw.info ||
        typeof raw.info !== 'object'
      )
        return
      const info = raw.info
      if ('playerState' in info && info.playerState !== 1)
        invalidate.current(
          'Video paused, buffered, or ended. Link this moment again after playback resumes.',
        )
      if ('playbackRate' in info && info.playbackRate !== linked.rate)
        invalidate.current('Playback speed changed. Link this moment again.')
      if (
        'currentTime' in info &&
        typeof info.currentTime === 'number' &&
        Number.isFinite(info.currentTime)
      ) {
        const now = performance.now()
        const last = lastClock.current
        if (
          last &&
          Math.abs(
            info.currentTime -
              last.time -
              ((now - last.at) / 1000) * linked.rate,
          ) > 0.35
        )
          invalidate.current('Video position changed. Link this moment again.')
        lastClock.current = { time: info.currentTime, at: now }
      }
    }
    window.addEventListener('message', onMessage)
    const timer = setInterval(() => {
      if (document.hidden) {
        invalidate.current(
          'Page hidden. Link this moment again when you return.',
        )
        return
      }
      if (
        !clock.isPlaying() ||
        clock.time() === null ||
        !lastClock.current ||
        performance.now() - lastClock.current.at > 1000
      )
        invalidate.current('Video clock interrupted. Link this moment again.')
    }, 100)
    return () => {
      clearInterval(timer)
      window.removeEventListener('message', onMessage)
    }
  }, [linked, clock])
  useEffect(() => {
    if (
      !capturing ||
      (linked && linked.segmentId !== capturePosition?.segmentId)
    ) {
      setLinked(null)
      lastClock.current = null
    }
  }, [capturing, capturePosition?.segmentId, linked])
  function linkMoment() {
    const time = clock.time()
    if (
      !videoId ||
      !capturing ||
      !capturePosition ||
      time === null ||
      !clock.isPlaying() ||
      !confirmed ||
      performance.now() - lastRawClockAt.current > 1000
    )
      return
    const anchor: VideoAnchor = {
      videoId,
      segmentId: capturePosition.segmentId,
      captureSample: capturePosition.sample,
      videoSeconds: Math.max(0, time + offset),
      rate: rate.current,
      status: 'approximate',
      userConfirmed: true,
    }
    lastClock.current = { time, at: performance.now() }
    setLinked(anchor)
    onAnchor(anchor)
    setMessage(
      'Approximate video annotation linked. Capture and playback delay are unknown.',
    )
  }
  return (
    <details className="live-video">
      <summary>Optional YouTube reference</summary>
      <p>
        Capture time is the default. An iframe cannot read audio or the position
        of an arbitrary shared tab. Ads and external seeks are not automatically
        detected.
      </p>
      <div className="live-field-row">
        <label>
          YouTube link or video ID
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </label>
        <button
          disabled={!youtubeVideoId(input)}
          onClick={() => {
            setVideoId(youtubeVideoId(input))
            setLinked(null)
            setConfirmed(false)
            setMessage(
              'Play the video, share its tab audio, then confirm the source to link a moment.',
            )
          }}
        >
          Open video
        </button>
      </div>
      {videoId && (
        <>
          <iframe
            ref={iframe}
            title="Optional YouTube reference video"
            src={`${ORIGIN}/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noreferrer"
          >
            Open on YouTube if playback is blocked
          </a>
          <label className="live-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm I am capturing this video’s audio.
          </label>
          <label>
            Manual video offset (seconds)
            <input
              type="number"
              min={-300}
              max={300}
              step={0.1}
              value={offset}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (Number.isFinite(value)) {
                  setOffset(Math.max(-300, Math.min(300, value)))
                  setLinked(null)
                  setMessage(
                    'Offset changed. Link this moment again to apply it.',
                  )
                }
              }}
            />
          </label>
          <div className="live-actions">
            <button
              disabled={
                !capturing ||
                !capturePosition ||
                !confirmed ||
                !clock.ready ||
                !clock.playing
              }
              onClick={linkMoment}
            >
              Link this moment to the video
            </button>
            <button
              disabled={!capturing}
              onClick={() => {
                setLinked(null)
                setMessage(
                  'Mapping broken. Capture paused for the ad or wrong section; resume for a new segment.',
                )
                onBreak()
              }}
            >
              Ad or wrong section
            </button>
          </div>
          {linked && capturePosition && (
            <p>
              Approximate video time:{' '}
              {(
                linked.videoSeconds +
                ((capturePosition.sample - linked.captureSample) / 24000) *
                  linked.rate
              ).toFixed(1)}{' '}
              seconds. Valid only within this uninterrupted segment.
            </p>
          )}
        </>
      )}
      {anchors.length > 0 && (
        <section aria-label="Saved video annotations">
          <p>
            Remove an incorrect annotation, then link a new moment during
            capture.
          </p>
          <ul>
            {anchors.map((anchor, index) => (
              <li key={`${index}:${anchor.segmentId}:${anchor.captureSample}`}>
                Segment {anchor.segmentId + 1}, capture{' '}
                {(anchor.captureSample / 24000).toFixed(2)} s → video{' '}
                {anchor.videoSeconds.toFixed(2)} s{' '}
                <button
                  onClick={() => {
                    setLinked(null)
                    onRemoveAnchor(index)
                  }}
                >
                  Remove annotation {index + 1}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p>
        {clock.error
          ? 'YouTube playback is blocked here. Open it on YouTube and use ordinary capture time.'
          : message}
      </p>
    </details>
  )
}
