import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseTab, stepMidiNotes, type SheetLine } from '../data/tabParser'
import type { SavedSong } from '../data/songbook'
import { midiToName } from '../audio/notes'
import { engine } from '../audio/engine'
import { chromaEnergies, chordMatchScore, detectPitch } from '../audio/pitch'
import { useSongPlayback } from './useSongPlayback'
import { useClockPosition } from './useYouTubeClock'
import { revealInPane } from './revealInPane'
import { SongPlayback } from './SongPlayback'
import { ChordDiagram } from './ChordDiagram'
import { TabBlock } from './TabBlock'
import { LyricsSheet } from './LyricsSheet'
import { YouTubeAnalysisPanel } from './YouTubeAnalysisPanel'
import {
  nextChangeIndex,
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
 * Play-along for one saved song: the pasted sheet with the sounding chord lit,
 * the video (or its audio) beside it, chord recognition, and the mic follow.
 * One clock position is sampled here and shared with every live readout.
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
  const nextIdx = nextChangeIndex(steps, idx)
  const upNext = nextIdx >= 0 ? steps[nextIdx] : undefined

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
      if (
        e.target instanceof Element &&
        Boolean(
          e.target.closest(
            'input, textarea, button, audio, summary, select, [contenteditable="true"]',
          ),
        )
      )
        return
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

  // Video follow: a synced sheet tracks the shared clock while the video plays
  // — the same map lets sheet taps seek the video.
  const followVideo = synced && !recording && !listening
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

  return (
    <section
      className={`songbook-stage${focusLyrics ? ' focus-lyrics' : ''}`}
      aria-label={`Playing ${song.title}`}
    >
      <div className="songbook-player-head">
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
            edit
          </button>
        )}
        <p className="songbook-hint">
          {recording
            ? 'space: mark the chord · esc: cancel'
            : steps.length
              ? '→ / space: next · ←: back · tap any chord'
              : 'Play the song · follow the lyrics and chords'}
        </p>
      </div>

      <div
        className={`songbook-follow${steps.length || analysis ? '' : ' video-only'}${analysis ? ' with-lyrics' : ''}`}
      >
        {(steps.length > 0 || analysis) && (
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
                      nextIdx={nextIdx}
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

        <aside className="songbook-side">
          {parsed.warnings.map((warning) => (
            <p className="songbook-warn" key={warning}>
              {warning}
            </p>
          ))}
          {song.youtubeId && (
            <SongPlayback
              videoId={song.youtubeId}
              title={song.title}
              duration={analysis?.duration ?? 0}
              playback={playback}
              position={position}
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

          {recording && now && (
            <div className="sync-recording" aria-live="polite">
              <p className="sync-status recording">
                <span className="sync-dot rec" aria-hidden="true" />
                video is playing — tap when <strong>
                  {now.chord.symbol}
                </strong>{' '}
                hits
                <span className="sync-count">
                  {draft.length}/{steps.length}
                </span>
              </p>
              <div className="songbook-nav">
                <button className="play-btn songbook-next" onClick={tapSync}>
                  {now.chord.symbol} now
                </button>
                <button className="quiet-btn" onClick={cancelRecording}>
                  cancel
                </button>
              </div>
            </div>
          )}

          {now && (
            <div className={`chord-card now${hit ? ' hit' : ''}`}>
              <span className="role">
                {now.section ? `${now.section} · now` : 'Now'}
              </span>
              <h2 className="chord-name">{now.chord.symbol}</h2>
              {now.chord.approx && (
                <p className="songbook-warn">closest playable shape</p>
              )}
              <p className="chord-notes">
                notes:{' '}
                <strong>
                  {[...new Set(stepMidiNotes(now).map(midiToName))].join(' · ')}
                </strong>
              </p>
              {now.kind !== 'notes' && (
                <ChordDiagram
                  shape={now.chord.shape}
                  accent={hit ? 'var(--moss)' : 'var(--ember)'}
                />
              )}
              <TabBlock shape={now.chord.shape} />
              {upNext && (
                <p className="chord-notes">
                  up next: <strong>{upNext.chord.symbol}</strong>
                </p>
              )}
            </div>
          )}

          {now && !recording && !timingLyrics && (
            <>
              <div className="songbook-nav">
                <button
                  className="quiet-btn"
                  onClick={() =>
                    jumpTo((idx - 1 + steps.length) % steps.length)
                  }
                  aria-label="Previous chord"
                >
                  ←
                </button>
                <button
                  className="play-btn songbook-next"
                  onClick={() => jumpTo((idx + 1) % steps.length)}
                >
                  next →
                </button>
              </div>

              <button
                className={`quiet-btn songbook-listen${listening ? ' live' : ''}`}
                onClick={toggleMic}
              >
                {listening ? 'Stop listening' : 'Listen to me play'}
              </button>
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
              <p className="listen-status songbook-listen-status">
                {micError ? (
                  micError
                ) : listening ? (
                  hit ? (
                    <strong>{now.chord.symbol} is ringing — moving on.</strong>
                  ) : (
                    `Play ${now.chord.symbol} — the sheet follows you.`
                  )
                ) : (
                  'Turn the mic on and the song advances as you play.'
                )}
              </p>
            </>
          )}
        </aside>
      </div>
    </section>
  )
}

/**
 * One line of the pasted sheet, exactly as pasted. Chord tokens are buttons
 * that seek; the sounding one is lit and the next change is hinted. Memoized
 * so the 10 Hz clock poll doesn't re-render every line.
 */
const SheetLineView = memo(function SheetLineView({
  line,
  idx,
  nextIdx,
  onJump,
}: {
  line: SheetLine
  idx: number
  nextIdx: number
  onJump: (i: number) => void
}) {
  if (line.kind === 'blank')
    return <div className="sheet-line blank">&nbsp;</div>
  return (
    <div className={`sheet-line ${line.kind}`}>
      {line.segments.map((seg, si) =>
        seg.kind === 'chord' && seg.step >= 0 ? (
          <button
            key={si}
            data-step={seg.step}
            className={`sheet-chord${seg.step === idx ? ' now' : ''}${seg.step === nextIdx ? ' next' : ''}`}
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
