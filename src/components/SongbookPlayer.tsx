import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseTab, stepMidiNotes, type SheetLine } from '../data/tabParser'
import type { SavedSong } from '../data/songbook'
import { engine } from '../audio/engine'
import { chromaEnergies, chordMatchScore, detectPitch } from '../audio/pitch'
import { useSongPlayback } from './useSongPlayback'
import { useClockPosition } from './useYouTubeClock'
import { revealInPane } from './revealInPane'
import { SongTransport, SongVideo } from './SongPlayback'
import { ChordDiagram } from './ChordDiagram'
import { ChordRunway } from './ChordRunway'
import { TabBlock } from './TabBlock'
import { LyricsSheet } from './LyricsSheet'
import { YouTubeAnalysisPanel } from './YouTubeAnalysisPanel'
import { resolveChord } from '../data/chordEngine'
import {
  chordAt,
  chordRuns,
  sheetChords,
  stepAtTime,
  validSyncTimes,
} from '../data/songSync'

interface Props {
  song: SavedSong
  onBack: () => void
  onEdit: () => void
  onGlow: (lit: boolean) => void
  onUpdate: (changes: Partial<Omit<SavedSong, 'id'>>) => void
}

/**
 * Play-along for one saved song. Top to bottom: the stand (the chord to play
 * now, with the chords to come sliding in beside it), the pasted sheet with
 * the sounding chord lit and the video beside it, and a transport bar pinned
 * to the bottom. One clock position is sampled here and shared with every
 * live readout.
 */
export function SongbookPlayer({
  song,
  onBack,
  onEdit,
  onGlow,
  onUpdate,
}: Props) {
  // Re-parse the original paste so the whole sheet (lyrics, staff lines,
  // sections) is available — older saves only stored the chord steps.
  const parsed = useMemo(() => parseTab(song.rawTab), [song.rawTab])
  const steps = parsed.steps
  const [idx, setIdx] = useState(0)
  const [listening, setListening] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [match, setMatch] = useState(0)
  const [hit, setHit] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [focusLyrics, setFocusLyrics] = useState(false)
  // The pasted sheet is the play-along; lyrics & chords is the secondary read.
  const [sheetView, setSheetView] = useState<'sheet' | 'lyrics'>('sheet')
  const [timingLyrics, setTimingLyrics] = useState(false)
  const analysis =
    song.videoAnalysis?.videoId === song.youtubeId
      ? song.videoAnalysis
      : undefined
  const suggestedLyrics = parsed.lines
    .filter((line) => line.kind === 'lyric' || line.kind === 'chords')
    .map((line) =>
      line.segments
        .filter((segment) => segment.kind === 'text')
        .map((segment) => segment.text)
        .join('')
        .trim(),
    )
    .filter((line) => line && !/^(?:capo|tuning)\s*:/i.test(line))
    .join('\n')
  const micRequest = useRef(0)

  // --- video sync ---
  const playback = useSongPlayback(song.youtubeId, analyzing)
  const clock = playback.clock
  const position = useClockPosition(clock)
  const [recording, setRecording] = useState(false)
  const [draft, setDraft] = useState<number[]>([])
  const syncTimes = validSyncTimes(song.syncTimes, steps.length)
    ? song.syncTimes
    : null
  const synced = syncTimes !== null

  // What sounds when: the synced sheet if we have it, else what was heard.
  const timedChords = useMemo(
    () =>
      !analysis
        ? []
        : syncTimes
          ? sheetChords(steps, syncTimes, analysis.duration)
          : analysis.chords.filter((chord) => chord.label !== 'N'),
    [analysis, syncTimes, steps],
  )

  const now = steps[idx]

  // Without a pasted sheet, the stand follows the chords heard in the video.
  // In a gap with no clear chord it shows the coming one, so it never blinks.
  const heardLabel = steps.length
    ? undefined
    : (
        chordAt(timedChords, position) ??
        timedChords.find((chord) => chord.start > position) ??
        timedChords.at(-1)
      )?.label
  const heardShape = useMemo(
    () => (heardLabel ? resolveChord(heardLabel) : null),
    [heardLabel],
  )

  // Video follow: a synced sheet tracks the shared clock while the video
  // plays — the same map lets sheet taps seek the video.
  const followVideo = synced && !recording && !listening

  // The runway runs on the song's clock while the video drives the sheet, and
  // walks the sheet one step at a time otherwise (unsynced, mic, tap-sync).
  const runwayUnit = steps.length && !followVideo ? 'steps' : 'seconds'
  const runway = useMemo(() => {
    const chords = !steps.length
      ? timedChords
      : followVideo && syncTimes
        ? sheetChords(steps, syncTimes, analysis?.duration ?? 0)
        : steps.map((step, i) => ({
            label: step.chord.symbol,
            start: i,
            end: i + 1,
          }))
    const sections = steps.flatMap((step, i) =>
      step.section && step.section !== steps[i - 1]?.section
        ? [
            {
              label: step.section,
              start: followVideo && syncTimes ? syncTimes[i] : i,
            },
          ]
        : [],
    )
    return { runs: chordRuns(chords), sections }
  }, [steps, timedChords, followVideo, syncTimes, analysis?.duration])

  // The sheet line holding the lit chord, and the lyric under it, get a band.
  const litLine = useMemo(
    () =>
      parsed.lines.findIndex((line) =>
        line.segments.some((seg) => seg.kind === 'chord' && seg.step === idx),
      ),
    [parsed.lines, idx],
  )
  const bandEnd =
    parsed.lines[litLine]?.kind === 'chords' &&
    parsed.lines[litLine + 1]?.kind === 'lyric'
      ? litLine + 1
      : litLine

  const advance = useCallback(
    (dir: 1 | -1) => setIdx((i) => (i + dir + steps.length) % steps.length),
    [steps.length],
  )

  /** One tap while recording: stamp the video time on the current step. */
  const tapSync = useCallback(() => {
    const t = clock.time()
    if (
      t == null ||
      !clock.isPlaying() ||
      (draft.length > 0 && t <= draft[draft.length - 1])
    )
      return
    const nextDraft = [...draft, t]
    if (nextDraft.length >= steps.length) {
      onUpdate({ syncTimes: nextDraft, syncSource: 'manual' })
      setRecording(false)
      setDraft([])
      setIdx(0)
      clock.pause()
      return
    }
    setDraft(nextDraft)
    setIdx(nextDraft.length)
  }, [clock, draft, steps.length, onUpdate])

  const startRecording = () => {
    micRequest.current++
    setListening(false)
    engine.mic.stop()
    setRecording(true)
    setDraft([])
    setIdx(0)
    clock.seek(0)
    clock.play()
  }

  const cancelRecording = useCallback(() => {
    setRecording(false)
    setDraft([])
    setIdx(0)
    clock.pause()
  }, [clock])

  const jumpTo = useCallback(
    (i: number) => {
      setIdx(i)
      if (syncTimes && !recording) clock.seek(syncTimes[i])
    },
    [syncTimes, recording, clock],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!steps.length || timingLyrics) return
      const target = e.target instanceof Element ? e.target : null
      // Fields, selects and the seek slider use these keys themselves.
      if (
        target?.closest(
          'input, textarea, audio, select, [contenteditable="true"]',
        )
      )
        return
      // A focused button answers Space on its own; arrows still step the
      // sheet after a chord or the play button was clicked.
      if (e.key === ' ' && target?.closest('button, summary')) return
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        if (recording) tapSync()
        else jumpTo((idx + 1) % steps.length)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (!recording) jumpTo((idx - 1 + steps.length) % steps.length)
      } else if (e.key === 'Escape' && recording) {
        cancelRecording()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    jumpTo,
    idx,
    steps.length,
    recording,
    tapSync,
    cancelRecording,
    timingLyrics,
  ])

  useEffect(() => {
    if (followVideo && syncTimes) setIdx(stepAtTime(syncTimes, position))
  }, [followVideo, syncTimes, position])

  // Keep the lit chord in view as the song moves along.
  useEffect(() => {
    const pane = sheetRef.current
    const lit = pane?.querySelector<HTMLElement>(`[data-step="${idx}"]`)
    if (pane && lit) revealInPane(pane, lit)
  }, [idx])

  // Mic follow-along: match the mic against the current chord; when it rings,
  // bloom the wall and step forward on its own.
  useEffect(() => {
    if (!listening || !now) return
    const midis = stepMidiNotes(now)
    const pcs = new Set(midis.map((midi) => midi % 12))
    let raf = 0
    let lastChroma = 0
    let smooth = 0
    let framesAbove = 0
    // Ignore the first beat after a step change so the tail of the previous
    // chord (often sharing notes) can't instantly trigger the next one.
    const armedAt = performance.now() + 700
    let advanced = false
    let advanceTimer: number | undefined

    const tick = () => {
      const frame = engine.mic.frame()
      const t = performance.now()
      if (frame && t - lastChroma > 100) {
        lastChroma = t
        let rms = 0
        for (let i = 0; i < frame.length; i++) rms += frame[i] * frame[i]
        rms = Math.sqrt(rms / frame.length)
        if (rms > 0.01) {
          const pitch =
            now.kind === 'notes' && midis.length === 1
              ? detectPitch(frame, engine.ctx.sampleRate)
              : null
          const score =
            now.kind === 'notes' && midis.length === 1
              ? pitch &&
                Math.abs(69 + 12 * Math.log2(pitch / 440) - midis[0]) < 0.45
                ? 1
                : 0
              : chordMatchScore(
                  chromaEnergies(frame, engine.ctx.sampleRate),
                  pcs,
                )
          smooth = smooth * 0.5 + score * 0.5
          // Same thresholds as Listen mode: real strums plateau ~0.65-0.8,
          // wrong chords sit below 0.5; two frames filters pick transients.
          if (t > armedAt && smooth > 0.58) {
            framesAbove++
            if (framesAbove >= 2 && !advanced) {
              advanced = true
              setHit(true)
              onGlow(true)
              advanceTimer = window.setTimeout(() => advance(1), 650)
            }
          } else {
            framesAbove = 0
          }
        } else {
          smooth *= 0.9
        }
        setMatch(smooth)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(advanceTimer)
    }
  }, [listening, now, advance, onGlow])

  // Let the bloom fade shortly after each hit.
  useEffect(() => {
    if (!hit) return
    const t = window.setTimeout(() => {
      setHit(false)
      onGlow(false)
    }, 900)
    return () => window.clearTimeout(t)
  }, [hit, onGlow])

  useEffect(
    () => () => {
      micRequest.current++
      engine.mic.stop()
      onGlow(false)
    },
    [onGlow],
  )

  const toggleMic = async () => {
    const requestId = ++micRequest.current
    if (listening) {
      engine.mic.stop()
      setListening(false)
      setMatch(0)
      setHit(false)
      onGlow(false)
      return
    }
    try {
      setMicError(null)
      clock.pause()
      await engine.mic.start()
      if (requestId !== micRequest.current) return
      setListening(true)
    } catch {
      if (requestId !== micRequest.current) return
      setMicError(
        'Microphone access was blocked. Allow the mic in your browser bar, then try again.',
      )
    }
  }

  const stepBy = (dir: 1 | -1) =>
    jumpTo((idx + dir + steps.length) % steps.length)
  const nowName = now?.chord.symbol ?? heardShape?.symbol
  const nowShape =
    now?.kind === 'notes' ? null : (now?.chord.shape ?? heardShape?.shape)
  const hasPages = steps.length > 0 || Boolean(analysis)
  const hasRail = Boolean(song.youtubeId) || parsed.warnings.length > 0

  return (
    <section
      className={`songbook-stage songbook-player${focusLyrics ? ' focus-lyrics' : ''}`}
      aria-label={`Playing ${song.title}`}
    >
      <header className="player-head">
        <button className="songbook-back" onClick={onBack}>
          ← Songbook
        </button>
        <h2 className="player-title">{song.title}</h2>
        {!recording && (
          <button
            className="player-edit"
            onClick={onEdit}
            aria-label={`Edit ${song.title}`}
          >
            Edit
          </button>
        )}
      </header>

      {nowName && (
        <div className="stand">
          <div className={`chord-card now${hit ? ' hit' : ''}`}>
            {now?.section && <span className="role">{now.section}</span>}
            <h2 className="chord-name">{nowName}</h2>
            {nowShape && (
              <ChordDiagram
                shape={nowShape}
                accent={hit ? 'var(--moss)' : 'var(--ember)'}
                width={104}
              />
            )}
            {now?.kind === 'notes' && <TabBlock shape={now.chord.shape} />}
            {now?.chord.approx && (
              <p className="songbook-warn">closest playable shape</p>
            )}
            {(listening || micError) && (
              <div className="stand-listen">
                {listening && (
                  <div
                    className="match-meter"
                    role="progressbar"
                    aria-valuenow={Math.round(match * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Chord match"
                  >
                    <div
                      className="match-fill"
                      style={{ width: `${Math.min(100, match * 120)}%` }}
                    />
                  </div>
                )}
                <p className="songbook-listen-status" aria-live="polite">
                  {micError ??
                    (hit
                      ? `${nowName} is ringing. Moving on.`
                      : `Play ${nowName} and the sheet follows you.`)}
                </p>
              </div>
            )}
          </div>
          <ChordRunway
            runs={runway.runs}
            sections={runway.sections}
            at={runwayUnit === 'steps' ? idx : position}
            unit={runwayUnit}
            clock={clock}
          />
        </div>
      )}

      <div
        className={`player-body${hasPages ? '' : ' no-pages'}${hasRail ? '' : ' no-rail'}`}
      >
        {hasPages && (
          <div className="songbook-pages">
            {analysis && steps.length > 0 && !recording && !timingLyrics && (
              <div className="sheet-views" aria-label="Song view">
                <button
                  aria-pressed={sheetView === 'sheet'}
                  onClick={() => setSheetView('sheet')}
                >
                  Chord sheet
                </button>
                <button
                  aria-pressed={sheetView === 'lyrics'}
                  onClick={() => setSheetView('lyrics')}
                >
                  Lyrics & notes
                </button>
              </div>
            )}
            {steps.length > 0 && (
              <div
                hidden={
                  Boolean(analysis) && sheetView === 'lyrics' && !recording
                }
              >
                <div className="sheet" ref={sheetRef} aria-label="Full tab">
                  {parsed.lines.map((line, li) => (
                    <SheetLineView
                      key={li}
                      line={line}
                      idx={idx}
                      band={li >= litLine && li <= bandEnd && litLine >= 0}
                      onJump={jumpTo}
                    />
                  ))}
                </div>
              </div>
            )}
            {analysis && (
              <div
                hidden={
                  recording || (steps.length > 0 && sheetView === 'sheet')
                }
              >
                <LyricsSheet
                  key={analysis.videoId}
                  analysis={analysis}
                  chords={timedChords}
                  saved={song.lyrics}
                  suggestedText={suggestedLyrics}
                  clock={clock}
                  position={position}
                  onSave={(lyrics) => onUpdate({ lyrics })}
                  onTimingChange={setTimingLyrics}
                  focused={focusLyrics}
                  onFocusChange={() => setFocusLyrics((value) => !value)}
                  onStartTiming={() => {
                    micRequest.current++
                    setListening(false)
                    engine.mic.stop()
                  }}
                />
              </div>
            )}
          </div>
        )}

        {hasRail && (
          <aside className="player-rail">
            {parsed.warnings.map((warning) => (
              <p className="songbook-warn" key={warning}>
                {warning}
              </p>
            ))}
            {song.youtubeId && (
              <SongVideo
                videoId={song.youtubeId}
                title={song.title}
                playback={playback}
              />
            )}
            {song.youtubeId && (
              <div hidden={recording}>
                <YouTubeAnalysisPanel
                  videoId={song.youtubeId}
                  steps={steps}
                  saved={song.videoAnalysis}
                  clock={clock}
                  position={position}
                  chords={timedChords}
                  syncSource={synced ? (song.syncSource ?? 'manual') : null}
                  onSetTiming={timingLyrics ? undefined : startRecording}
                  onBusy={setAnalyzing}
                  onResult={(videoAnalysis, times, detectedTitle) =>
                    onUpdate({
                      title:
                        song.title === 'Untitled song' && detectedTitle
                          ? detectedTitle
                          : song.title,
                      videoAnalysis,
                      ...(!validSyncTimes(song.syncTimes, steps.length) &&
                      times &&
                      validSyncTimes(times, steps.length)
                        ? { syncTimes: times, syncSource: 'automatic' as const }
                        : {}),
                    })
                  }
                />
              </div>
            )}
          </aside>
        )}
      </div>

      {(song.youtubeId || now) && (
        <div className="player-bar">
          {song.youtubeId && (
            <SongTransport
              duration={analysis?.duration ?? 0}
              playback={playback}
              position={position}
            />
          )}
          {recording && now ? (
            <div className="sync-recording" aria-live="polite">
              <p className="sync-status recording">
                <span className="sync-dot rec" aria-hidden="true" />
                <span>
                  Tap when <strong>{now.chord.symbol}</strong> hits. Space works
                  too; Esc cancels.
                </span>
                <span className="sync-count">
                  {draft.length}/{steps.length}
                </span>
              </p>
              <button className="play-btn" onClick={tapSync}>
                {now.chord.symbol} now
              </button>
              <button className="quiet-btn" onClick={cancelRecording}>
                Cancel
              </button>
            </div>
          ) : (
            now &&
            !timingLyrics && (
              <div className="step-controls">
                <button
                  className="quiet-btn step-btn"
                  onClick={() => stepBy(-1)}
                  aria-label="Previous chord"
                  title="Previous chord (←)"
                >
                  ‹
                </button>
                <button
                  className="quiet-btn step-btn"
                  onClick={() => stepBy(1)}
                  aria-label="Next chord"
                  title="Next chord (→ or space)"
                >
                  ›
                </button>
                <button
                  className={`quiet-btn songbook-listen${listening ? ' live' : ''}`}
                  onClick={toggleMic}
                >
                  {listening ? 'Stop listening' : 'Listen to me play'}
                </button>
              </div>
            )
          )}
        </div>
      )}
    </section>
  )
}

/**
 * One line of the pasted sheet, exactly as pasted. Chord tokens are buttons
 * that seek; only the sounding one is lit, and its line carries a soft band.
 * Memoized so the 10 Hz clock poll doesn't re-render every line.
 */
const SheetLineView = memo(function SheetLineView({
  line,
  idx,
  band,
  onJump,
}: {
  line: SheetLine
  idx: number
  band: boolean
  onJump: (i: number) => void
}) {
  if (line.kind === 'blank')
    return <div className="sheet-line blank">&nbsp;</div>
  return (
    <div className={`sheet-line ${line.kind}${band ? ' band' : ''}`}>
      {line.segments.map((seg, si) =>
        seg.kind === 'chord' && seg.step >= 0 ? (
          <button
            key={si}
            data-step={seg.step}
            className={`sheet-chord${seg.step === idx ? ' now' : ''}`}
            onClick={() => onJump(seg.step)}
            aria-label={`Jump to ${seg.text}`}
            aria-current={seg.step === idx ? 'step' : undefined}
          >
            {seg.text}
          </button>
        ) : (
          <span key={si}>{seg.text}</span>
        ),
      )}
    </div>
  )
})
