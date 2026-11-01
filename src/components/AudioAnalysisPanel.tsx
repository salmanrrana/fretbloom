import { supportsAutomaticAlignment } from '../audio/analysisCompatibility'
import { useEffect, useRef, useState } from 'react'
import {
  analyzeUploadedAudio,
  analyzeYouTubeAudio,
} from '../audio/analysisClient'
import {
  DEFAULT_OPTIONS,
  MODES,
  parseOptions,
  type AnalysisOptions,
  type Job,
  type NoteEvent,
  type ResultEnvelope,
} from '../audio/analysisV1'
import { alignRichAnalysis } from '../audio/analysisAdapter'
import { analysisSequenceKey, type SavedAudioAnalysis } from '../data/songbook'
import type { ParsedStep } from '../data/tabParser'
import type { VideoClock } from './useYouTubeClock'

export interface AudioAnalysisProps {
  videoId: string | null
  steps: ParsedStep[]
  saved?: SavedAudioAnalysis
  initialFile?: File
  position: number
  clock: VideoClock
  syncSource: 'manual' | 'automatic' | null
  playbackReady?: boolean
  onSetTiming?: () => void
  onBusy: (busy: boolean) => void
  onResult: (
    saved: SavedAudioAnalysis,
    envelope: ResultEnvelope,
    audio: Blob,
  ) => void
}
type Status =
  | { kind: 'idle' | 'ready' | 'canceled' }
  | { kind: 'busy'; job: Job | null }
  | { kind: 'error'; message: string }
function timestamp(t: number) {
  return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`
}

/** Server analysis belongs to the song's real playback clock, never to a shape guess. */
export function AudioAnalysisPanel(props: AudioAnalysisProps) {
  const [options, setOptions] = useState<AnalysisOptions>(
    props.saved?.analysis.options ?? DEFAULT_OPTIONS,
  )
  const [status, setStatus] = useState<Status>({
    kind: props.saved ? 'ready' : 'idle',
  })
  const [current, setCurrent] = useState(props.saved)
  const [attempt, setAttempt] = useState(0)
  const [file, setFile] = useState(props.initialFile)
  const request = useRef<AbortController | null>(null)
  const latest = useRef(props)
  latest.current = props
  const sourceKey = props.videoId ?? 'upload'
  const sequenceKey = analysisSequenceKey(props.steps)
  useEffect(() => {
    // A result already on the song is evidence; opening it must not force a write.
    if (
      attempt === 0 &&
      !file &&
      (latest.current.saved || !latest.current.videoId)
    )
      return
    const controller = new AbortController()
    request.current = controller
    setStatus({ kind: 'busy', job: null })
    latest.current.onBusy(true)
    const timer = window.setTimeout(() => {
      const client = {
        signal: controller.signal,
        onStatus: (job: Job) => {
          if (!controller.signal.aborted) setStatus({ kind: 'busy', job })
        },
      }
      const run = file
        ? analyzeUploadedAudio(file, options, client)
        : latest.current.videoId
          ? analyzeYouTubeAudio(latest.current.videoId, options, client)
          : Promise.reject(new Error('Choose a recording to analyze.'))
      void run
        .then(({ result, features, audio }) => {
          if (controller.signal.aborted) return
          const steps = latest.current.steps
          const alignment = alignRichAnalysis(result, features, steps)
          const saved: SavedAudioAnalysis = {
            schemaVersion: 1,
            source: result.source,
            pcmSha256: result.pcmSha256,
            analysis: result.analysis,
            sequenceKey: analysisSequenceKey(steps),
            alignment: {
              times: alignment.reliable ? alignment.times : null,
              endTime: alignment.reliable ? alignment.endTime : null,
              transpose: steps.length ? alignment.transpose : 0,
              reason: steps.length ? alignment.reason : null,
            },
          }
          setCurrent(saved)
          setStatus({ kind: 'ready' })
          latest.current.onResult(saved, result, audio)
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setStatus({
              kind: 'error',
              message:
                error instanceof Error
                  ? error.message
                  : 'Analysis failed. Try again with a different recording.',
            })
        })
        .finally(() => {
          if (request.current === controller) latest.current.onBusy(false)
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
      latest.current.onBusy(false)
    }
    // Options are applied on explicit Analyze; writes from onResult cannot restart this job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, file, attempt])

  const busy = status.kind === 'busy'
  const analysis = current?.analysis
  const now =
    props.playbackReady === false
      ? undefined
      : analysis?.harmony.find(
          (e) => e.start <= props.position && props.position < e.end,
        )
  const stale =
    current &&
    (current.sequenceKey !== sequenceKey ||
      !supportsAutomaticAlignment(current.analysis.engineVersion))
  const notes = (label: string, stream: NoteEvent[]) => (
    <details className="analysis-stream">
      <summary>
        {label} · {stream.length} estimates
      </summary>
      {stream.length ? (
        <ol>
          {stream.map((n, i) => (
            <li key={i}>
              <button onClick={() => props.clock.seek(n.start)}>
                {timestamp(n.start)}–{timestamp(n.end)} · {n.name} ·{' '}
                {n.cents.toFixed(1)} cents · {n.evidence.level} evidence
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p>No supported notes in this stream.</p>
      )}
    </details>
  )
  return (
    <section
      className="recording-panel audio-analysis"
      aria-label="Full audio analysis"
    >
      <h3>Audio analysis</h3>
      <p className="recording-help">
        Recordings are sent to this server for analysis. Up to 50 MiB and 10
        minutes. The microphone tuner stays on your device.
      </p>
      {!props.videoId && (
        <label className="analysis-upload">
          {current ? 'Reattach or replace recording' : 'Choose recording'}
          <input
            type="file"
            accept="audio/*,video/mp4,video/webm,.m4a,.flac,.ogg"
            aria-label="Recording file"
            onChange={(event) => {
              const next = event.target.files?.[0]
              if (next) {
                request.current?.abort()
                setFile(next)
                setAttempt((a) => a + 1)
              }
              event.target.value = ''
            }}
          />
        </label>
      )}
      {!props.videoId && !file && (
        <p className="recording-help">
          Audio is temporary. Reattach the recording after reopening this song.
          Timing is reused only after the decoded audio hash is verified.
        </p>
      )}
      <div className="analysis-options">
        <label>
          Voices
          <select
            aria-label="Analysis mode"
            disabled={busy}
            value={options.mode}
            onChange={(e) =>
              setOptions(parseOptions({ ...options, mode: e.target.value }))
            }
          >
            {MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === 'auto'
                  ? 'Automatic'
                  : mode === 'monophonic'
                    ? 'Single voice'
                    : 'Multiple voices'}
              </option>
            ))}
          </select>
        </label>
        <label>
          A4 reference (Hz)
          <input
            aria-label="Concert A reference"
            type="number"
            min={432}
            max={446}
            step={0.1}
            disabled={busy}
            value={options.concertAHz}
            onChange={(e) => {
              const hz = e.target.valueAsNumber
              if (Number.isFinite(hz) && hz >= 432 && hz <= 446)
                setOptions({ ...options, concertAHz: hz })
            }}
          />
        </label>
        <label>
          Note spelling
          <select
            aria-label="Note spelling"
            disabled={busy}
            value={options.spelling}
            onChange={(e) =>
              setOptions(parseOptions({ ...options, spelling: e.target.value }))
            }
          >
            <option value="sharps">Sharps</option>
            <option value="flats">Flats</option>
          </select>
        </label>
      </div>
      {busy ? (
        <>
          <p role="status">
            {status.job?.progress.stage ?? 'Connecting to analysis service'}
            {status.job?.progress.fraction != null
              ? ` · ${Math.round(status.job.progress.fraction * 100)}%`
              : ''}
          </p>
          <progress
            aria-label="Analysis stage progress"
            max={1}
            value={status.job?.progress.fraction ?? undefined}
          />
          <button
            className="quiet-btn"
            onClick={() => {
              request.current?.abort()
              props.onBusy(false)
              setStatus({ kind: 'canceled' })
            }}
          >
            Cancel analysis
          </button>
        </>
      ) : (
        <button
          className="quiet-btn"
          disabled={!props.videoId && !file}
          onClick={() => setAttempt((a) => a + 1)}
        >
          {analysis ? 'Analyze recording again' : 'Analyze recording'}
        </button>
      )}
      {status.kind === 'error' && (
        <p role="alert" className="songbook-warn">
          {status.message} Full analysis requires the Rust backend; it is never
          replaced silently by browser estimates.
        </p>
      )}
      {status.kind === 'canceled' && <p role="status">Analysis canceled.</p>}
      {stale && (
        <p className="songbook-warn">
          Saved estimates are from an earlier sheet or engine. Analyze again
          before using automatic timing.
        </p>
      )}
      {current?.alignment.reason && (
        <p className="recording-help">{current.alignment.reason}</p>
      )}
      {props.steps.length > 0 && (
        <p className="recording-help">
          {props.syncSource === 'manual'
            ? 'Your manual timing is preserved.'
            : props.syncSource === 'automatic'
              ? 'Sheet timing follows the analyzed recording.'
              : 'The sheet has no verified timing yet.'}{' '}
          {props.onSetTiming && (
            <button className="quiet-btn" onClick={props.onSetTiming}>
              Set timing manually
            </button>
          )}
        </p>
      )}
      {analysis && (
        <>
          <p className="recording-now">
            Now:{' '}
            <strong>
              {now?.kind === 'chord'
                ? now.primary.label
                : now?.kind === 'unknown'
                  ? 'Uncertain harmony'
                  : now?.kind === 'no_chord'
                    ? now.reason.replaceAll('_', ' ')
                    : '—'}
            </strong>
            {now?.bass && (
              <>
                {' '}
                · lowest supported pitch: MIDI {now.bass.midi} (
                {now.bass.evidence.level} evidence)
              </>
            )}
          </p>
          <p className="recording-help">
            These are estimates, not exact guitar positions. Bass may come from
            another instrument. Added second and ninth names share a pitch-class
            set here.
          </p>
          {analysis.warnings.map((w, i) => (
            <p className="songbook-warn" key={i}>
              {w.message}
            </p>
          ))}
          <details className="analysis-stream">
            <summary>
              Harmony · {analysis.harmony.length} spans, including silence and
              uncertainty
            </summary>
            {analysis.harmony.length ? (
              <ol>
                {analysis.harmony.map((e, i) => (
                  <li key={i} aria-current={e === now ? 'time' : undefined}>
                    <button onClick={() => props.clock.seek(e.start)}>
                      {timestamp(e.start)}–{timestamp(e.end)} ·{' '}
                      {e.kind === 'chord'
                        ? e.primary.label
                        : e.kind === 'unknown'
                          ? 'Uncertain'
                          : e.reason.replaceAll('_', ' ')}
                    </button>
                    {e.kind === 'chord' && (
                      <span>
                        {' '}
                        ·{' '}
                        {e.primary.evidence.level === 'high'
                          ? 'Strong'
                          : e.primary.evidence.level}{' '}
                        evidence · fit {e.primary.evidence.score.toFixed(2)},
                        margin {e.primary.evidence.margin.toFixed(2)} (not a
                        probability)
                        {e.primary.missingPitchClasses.length > 0 &&
                          ` · missing pitch classes ${e.primary.missingPitchClasses.join(', ')}`}
                      </span>
                    )}
                    {e.kind !== 'no_chord' && e.alternatives.length > 0 && (
                      <p>
                        Could also be{' '}
                        {e.alternatives
                          .map(
                            (a) =>
                              `${a.label} (fit ${a.evidence.score.toFixed(2)})`,
                          )
                          .join(', ')}
                        .
                      </p>
                    )}
                    {e.bass && (
                      <p>
                        Lowest supported pitch: MIDI {e.bass.midi} ·{' '}
                        {e.bass.evidence.level} evidence.
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p>No supported harmony events.</p>
            )}
          </details>
          {notes('Monophonic melody', analysis.monophonicNotes)}
          {notes('Tentative polyphonic notes', analysis.polyphonicNotes)}
          <p className="recording-help">
            {analysis.engineVersion} · {analysis.timingResolutionSeconds * 1000}{' '}
            ms time grid, not an accuracy guarantee · tuning offset{' '}
            {analysis.tuning.estimatedOffsetCents === null
              ? 'unresolved'
              : `${analysis.tuning.estimatedOffsetCents.toFixed(1)} cents`}
            .
          </p>
          <button
            className="quiet-btn"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(current, null, 2)], {
                  type: 'application/json',
                }),
              )
              const a = document.createElement('a')
              a.href = url
              a.download = 'audio-analysis.json'
              a.click()
              window.setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}
          >
            Download analysis JSON
          </button>
        </>
      )}
    </section>
  )
}
