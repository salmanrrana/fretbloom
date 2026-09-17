import { useEffect, useRef, useState } from 'react'
import { analyzeYouTube } from '../audio/youtubeAnalysis'
import { alignSong } from '../audio/songAlignment'
import { midiToNameWithOctave } from '../audio/notes'
import { stepMidiNotes, type ParsedStep } from '../data/tabParser'
import type { VideoAnalysis } from '../data/songbook'
import type { VideoClock } from './useYouTubeClock'

interface Props {
  videoId: string
  steps: ParsedStep[]
  saved?: VideoAnalysis
  clock: VideoClock
  onResult: (
    result: VideoAnalysis,
    times: number[] | null,
    title: string | null,
  ) => void
  onBusy: (busy: boolean) => void
}

type Status =
  | { kind: 'fetching' }
  | { kind: 'analyzing'; progress: number }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }
  | { kind: 'canceled' }

function timestamp(time: number): string {
  return `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, '0')}`
}

/** A linked video is retrieved and analyzed automatically; no user audio files. */
export function YouTubeAnalysisPanel(props: Props) {
  const { videoId, steps, saved, clock } = props
  const latest = useRef(props)
  latest.current = props
  const sequenceKey = JSON.stringify(
    steps.map((step) => [step.kind ?? 'chord', stepMidiNotes(step)]),
  )
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<Status>({ kind: 'fetching' })
  const [result, setResult] = useState<VideoAnalysis | null>(null)
  const [position, setPosition] = useState(0)
  const request = useRef<AbortController | null>(null)

  useEffect(() => {
    if (
      saved?.videoId === videoId &&
      saved.sequenceKey === sequenceKey &&
      (saved.times !== undefined || steps.length === 0) &&
      attempt === 0
    ) {
      setResult(saved)
      setStatus({ kind: 'ready' })
      latest.current.onBusy(false)
      latest.current.onResult(saved, saved.times ?? null, null)
      return
    }
    const controller = new AbortController()
    request.current = controller
    setResult(null)
    setStatus({ kind: 'fetching' })
    latest.current.onBusy(true)
    // A brief debounce also avoids duplicate retrievals under React StrictMode.
    const debounce = window.setTimeout(() => {
      let timedOut = false
      const deadline = window.setTimeout(() => {
        timedOut = true
        controller.abort()
      }, 180_000)
      void analyzeYouTube(videoId, {
        signal: controller.signal,
        onAnalyzing: () => {
          if (!controller.signal.aborted)
            setStatus({ kind: 'analyzing', progress: 0 })
        },
        onProgress: (progress) => {
          if (!controller.signal.aborted)
            setStatus({ kind: 'analyzing', progress })
        },
      })
        .then(({ analysis, title }) => {
          if (controller.signal.aborted) return
          const targets = latest.current.steps.map((step) => ({
            midis: stepMidiNotes(step),
            kind: step.kind ?? 'chord',
          }))
          const alignment = alignSong(analysis, targets)
          const next: VideoAnalysis = {
            videoId,
            sequenceKey,
            duration: analysis.duration,
            notes: analysis.notes,
            syncReason: targets.length ? alignment.reason : null,
            times: alignment.reliable ? alignment.times : null,
          }
          setResult(next)
          setStatus({ kind: 'ready' })
          latest.current.onResult(
            next,
            alignment.reliable ? alignment.times : null,
            title,
          )
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted && !timedOut) return
          setStatus({
            kind: 'error',
            message: timedOut
              ? 'YouTube took too long to respond. Try again.'
              : error instanceof Error
                ? error.message
                : 'This video could not be analyzed. Try another YouTube link.',
          })
        })
        .finally(() => {
          window.clearTimeout(deadline)
          if (request.current === controller) latest.current.onBusy(false)
        })
    }, 400)
    return () => {
      window.clearTimeout(debounce)
      controller.abort()
    }
    // A saved result is written by this effect. Changes to it must not restart a job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, sequenceKey, attempt])

  useEffect(() => {
    const tick = () => {
      const time = clock.time()
      if (time !== null) setPosition(time)
    }
    tick()
    const timer = window.setInterval(tick, 100)
    return () => window.clearInterval(timer)
  }, [clock])

  const busy = status.kind === 'fetching' || status.kind === 'analyzing'
  const heard = result?.notes.find(
    (note) => note.start <= position && position < note.end,
  )
  return (
    <section className="recording-panel" aria-label="YouTube analysis">
      <h3>{busy ? 'Finding the notes…' : 'Notes from this video'}</h3>
      {busy && (
        <>
          <p className="recording-help" role="status">
            {status.kind === 'fetching'
              ? 'Getting the video’s audio. This can take a minute.'
              : 'Listening for notes and matching your tab…'}
          </p>
          {status.kind === 'fetching' && (
            <progress aria-label="Retrieving song audio" />
          )}
          {status.kind === 'analyzing' && (
            <progress
              aria-label="Analyzing video"
              max={1}
              value={status.progress}
            />
          )}
          <button
            className="quiet-btn"
            onClick={() => {
              request.current?.abort()
              latest.current.onBusy(false)
              setStatus({ kind: 'canceled' })
            }}
          >
            Cancel analysis
          </button>
        </>
      )}
      {status.kind === 'error' && (
        <p className="songbook-warn" role="alert">
          {status.message}
        </p>
      )}
      {status.kind === 'canceled' && (
        <p className="recording-help" role="status">
          Analysis canceled.
        </p>
      )}
      {(status.kind === 'error' || status.kind === 'canceled') && (
        <button
          className="quiet-btn"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Try analysis again
        </button>
      )}
      {result && (
        <>
          <p className="recording-heard">
            Estimated note:{' '}
            <strong>{heard ? midiToNameWithOctave(heard.midi) : '—'}</strong>
          </p>
          {result.syncReason && (
            <p className="recording-help">{result.syncReason}</p>
          )}
          {result.notes.length ? (
            <details className="recording-notes">
              <summary>
                {result.notes.length} estimated notes · tap to seek song
              </summary>
              <ol>
                {result.notes.slice(0, 300).map((note, index) => (
                  <li key={index}>
                    <button onClick={() => clock.seek(note.start)}>
                      <span>{timestamp(note.start)}</span>
                      {midiToNameWithOctave(note.midi)}
                    </button>
                  </li>
                ))}
              </ol>
              {result.notes.length > 300 && (
                <p className="recording-help">Showing the first 300 notes.</p>
              )}
            </details>
          ) : (
            <p className="recording-help">
              No clear individual notes found. A cleaner guitar recording may
              work better.
            </p>
          )}
        </>
      )}
      <p className="recording-help">
        Works with public videos up to 10 minutes. Note estimates are best with
        a clear instrument.
      </p>
    </section>
  )
}
