import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyzeYouTube } from '../audio/youtubeAnalysis'
import { alignSong } from '../audio/songAlignment'
import { midiToNameWithOctave } from '../audio/notes'
import { stepMidiNotes, type ParsedStep } from '../data/tabParser'
import type { SavedSong, VideoAnalysis } from '../data/songbook'
import { chordAt, sounds, type TimedChord } from '../data/songSync'
import type { VideoClock } from './useYouTubeClock'

interface Props {
  videoId: string
  steps: ParsedStep[]
  saved?: VideoAnalysis
  clock: VideoClock
  /** Shared clock position, sampled by the player. */
  position: number
  /** What sounds when — the synced sheet if there is one, else what was heard. */
  chords: readonly TimedChord[]
  /** How the sheet is timed, or null while it is not. */
  syncSource: NonNullable<SavedSong['syncSource']> | null
  /** Starts the tap-through; absent while another timing task owns the clock. */
  onSetTiming?: () => void
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

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** A linked video is retrieved and analyzed automatically; no user audio files. */
export function YouTubeAnalysisPanel(props: Props) {
  const {
    videoId,
    steps,
    saved,
    clock,
    position,
    chords,
    syncSource,
    onSetTiming,
  } = props
  const latest = useRef(props)
  latest.current = props
  const sequenceKey = JSON.stringify(
    steps.map((step) => [step.kind ?? 'chord', stepMidiNotes(step)]),
  )
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<Status>({ kind: 'fetching' })
  const [result, setResult] = useState<VideoAnalysis | null>(null)
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
            label: step.chord.symbol,
          }))
          const alignment = alignSong(analysis, targets)
          const next: VideoAnalysis = {
            videoId,
            sequenceKey,
            duration: analysis.duration,
            notes: analysis.notes,
            chords: analysis.chords,
            syncReason: targets.length ? alignment.reason : null,
            times: alignment.reliable ? alignment.times : null,
            transpose: targets.length ? alignment.transpose : 0,
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

  const busy = status.kind === 'fetching' || status.kind === 'analyzing'
  const heardChords = useMemo(
    () => result?.chords.filter((chord) => chord.label !== 'N'),
    [result],
  )
  const seek = useCallback((time: number) => clock.seek(time), [clock])
  // Single-note estimates only matter when nothing was recognized as a chord,
  // or when the sheet is a numbered tab of single notes.
  const showNotes =
    result !== null &&
    (heardChords?.length === 0 || steps.some((step) => step.kind === 'notes'))
  const nowChord = chordAt(chords, position)
  const capoHint =
    result && result.transpose !== 0 && result.times && steps.length > 0
      ? result.transpose > 0
        ? `This recording sounds ${plural(result.transpose, 'semitone')} above your sheet — try a capo on fret ${result.transpose}, or transpose up.`
        : `This recording sounds ${plural(-result.transpose, 'semitone')} below your sheet — transpose down ${-result.transpose} to match.`
      : null
  return (
    <section className="recording-panel" aria-label="YouTube analysis">
      <h3>{busy ? 'Finding the chords…' : 'Chords from this video'}</h3>
      {busy && (
        <>
          <p className="recording-help" role="status">
            {status.kind === 'fetching'
              ? 'Getting the video’s audio. This can take a minute.'
              : 'Listening for chords and matching your sheet…'}
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
        <p className="recording-now">
          Now: <strong>{nowChord?.label ?? '—'}</strong>
        </p>
      )}
      {steps.length > 0 &&
        !busy &&
        (syncSource ? (
          <>
            <p className="sync-status" aria-live="polite">
              <span className="sync-dot" aria-hidden="true" />
              synced to video — press play and the chords follow
              {onSetTiming && (
                <button className="sync-redo" onClick={onSetTiming}>
                  redo sync
                </button>
              )}
            </p>
            {syncSource === 'automatic' && result?.syncReason && (
              <p className="recording-help">{result.syncReason}</p>
            )}
          </>
        ) : (
          <>
            {result?.syncReason && (
              <p className="recording-help">{result.syncReason}</p>
            )}
            {onSetTiming && (
              <button className="sync-btn" onClick={onSetTiming}>
                Set timing manually
              </button>
            )}
          </>
        ))}
      {capoHint && <p className="recording-help">{capoHint}</p>}
      {result && heardChords && (
        <>
          {heardChords.length ? (
            <div className="chord-timeline">
              <p className="recording-help">
                {plural(heardChords.length, 'chord change')} heard · tap to seek
              </p>
              <ol>
                {heardChords.map((chord) => (
                  <HeardChord
                    key={chord.start}
                    chord={chord}
                    current={sounds(chord, position)}
                    onSeek={seek}
                  />
                ))}
              </ol>
            </div>
          ) : (
            <p className="recording-help">
              No clear chords were heard. A cleaner recording may work better.
            </p>
          )}
          {showNotes && result.notes.length > 0 && (
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
          )}
        </>
      )}
      <p className="recording-help">
        Works with public videos up to 10 minutes. Chord recognition is best
        with a clear, well-mixed recording.
      </p>
    </section>
  )
}

/** One chip of the heard-chord timeline; memoized so a tick only redraws the chip that changed. */
const HeardChord = memo(function HeardChord({
  chord,
  current,
  onSeek,
}: {
  chord: TimedChord
  current: boolean
  onSeek: (time: number) => void
}) {
  return (
    <li>
      <button
        onClick={() => onSeek(chord.start)}
        aria-current={current ? 'time' : undefined}
        aria-label={`${chord.label} at ${timestamp(chord.start)}`}
      >
        <span>{timestamp(chord.start)}</span>
        {chord.label}
      </button>
    </li>
  )
})
