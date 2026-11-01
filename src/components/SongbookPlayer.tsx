import { INITIAL_MIC_MATCH, nextMicMatch } from '../audio/micMatchState'
import { supportsAutomaticAlignment } from '../audio/analysisCompatibility'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseTab, stepMidiNotes, type SheetLine } from '../data/tabParser'
import {
  analysisSequenceKey,
  VIDEO_ANALYSIS_VERSION,
  type SavedAudioAnalysis,
  type SavedSong,
  type VideoAnalysis,
} from '../data/songbook'
import { analysisProjection, sameRecording } from '../audio/analysisAdapter'
import type { ResultEnvelope } from '../audio/analysisV1'
import { AudioAnalysisPanel } from './AudioAnalysisPanel'
import {
  alignmentTarget,
  chordPitchClasses,
  parseChordIdentity,
} from '../data/chordIdentity'
import { chordMidiNotes } from '../data/chords'
import { midiToName, midiToNameWithOctave } from '../audio/notes'
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
import { lyricRows, parseLyrics, type SongLyrics } from '../data/lyrics'
import type { TimedChord } from '../data/songSync'
import type { VideoClock } from './useYouTubeClock'
import { YouTubeAnalysisPanel } from './YouTubeAnalysisPanel'
import { resolveChord } from '../data/chordEngine'
import {
  chordAt,
  chordRuns,
  sheetChords,
  sounds,
  stepAtTime,
  validSyncTimes,
} from '../data/songSync'

interface Props {
  song: SavedSong
  initialFile?: File
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
  initialFile,
  onBack,
  onEdit,
  onGlow,
  onUpdate,
}: Props) {
  // Re-parse the original paste so the whole sheet (lyrics, staff lines,
  // sections) is available — older saves only stored the chord steps.
  const parsed = useMemo(() => parseTab(song.rawTab), [song.rawTab])
  const steps = parsed.steps
  const [practiceIdx, setIdx] = useState(0)
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
  const [sessionAnalysis, setSessionAnalysis] = useState<
    SavedAudioAnalysis | undefined
  >()
  const [sessionAudio, setSessionAudio] = useState<{
    hash: string
    audio: Blob
  } | null>(null)
  const [analysisSaveError, setAnalysisSaveError] = useState<string | null>(
    null,
  )
  const rich = sessionAnalysis ?? song.audioAnalysis
  const sourceFits =
    rich?.source.kind === 'youtube'
      ? rich.source.videoId === song.youtubeId
      : rich?.source.kind === 'upload' && song.youtubeId === null
  const richProjection = useMemo(
    (): VideoAnalysis | undefined =>
      rich && sourceFits
        ? {
            ...analysisProjection(rich.analysis),
            version: VIDEO_ANALYSIS_VERSION,
            videoId: rich.source.kind === 'youtube' ? rich.source.videoId : '',
            sequenceKey: rich.sequenceKey,
            syncReason: rich.alignment.reason,
            times: rich.alignment.times,
            endTime: rich.alignment.endTime,
            transpose: rich.alignment.transpose,
          }
        : undefined,
    [rich, sourceFits],
  )
  const analysis =
    richProjection ??
    (song.videoAnalysis?.videoId === song.youtubeId
      ? song.videoAnalysis
      : undefined)
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
  const playbackSource = song.youtubeId
    ? {
        kind: 'youtube' as const,
        videoId: song.youtubeId,
        audio: sessionAudio?.audio ?? null,
        verifiedAudioRequired: Boolean(rich),
      }
    : rich || initialFile
      ? {
          kind: 'upload' as const,
          identity: rich?.pcmSha256 ?? song.id,
          audio: sessionAudio?.audio ?? null,
        }
      : null
  const playback = useSongPlayback(playbackSource, analyzing)
  const clock = playback.clock
  const position = useClockPosition(clock)
  const [videoEnded, setVideoEnded] = useState(false)
  useEffect(() => {
    setVideoEnded(false)
    if (playback.useAudio) return
    const onMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== 'https://www.youtube-nocookie.com' ||
        event.source !== playback.iframeRef.current?.contentWindow
      )
        return
      let data: unknown
      try {
        data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (
        !data ||
        typeof data !== 'object' ||
        !('event' in data) ||
        (data.event !== 'infoDelivery' && data.event !== 'initialDelivery') ||
        !('info' in data) ||
        !data.info ||
        typeof data.info !== 'object' ||
        !('playerState' in data.info) ||
        typeof data.info.playerState !== 'number'
      )
        return
      setVideoEnded(data.info.playerState === 0)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [song.youtubeId, playback.useAudio, playback.iframeRef])
  const audio = playback.audioRef.current
  const audioDuration =
    playback.useAudio && audio && Number.isFinite(audio.duration)
      ? audio.duration
      : undefined
  const mediaEnded = playback.useAudio ? Boolean(audio?.ended) : videoEnded
  const [recording, setRecording] = useState(false)
  const [draft, setDraft] = useState<number[]>([])
  const richTimingCurrent =
    !rich ||
    (sourceFits &&
      supportsAutomaticAlignment(rich.analysis.engineVersion) &&
      rich.sequenceKey === analysisSequenceKey(steps) &&
      sessionAudio?.hash === rich.pcmSha256)
  const syncTimes =
    validSyncTimes(song.syncTimes, steps.length) &&
    (!rich || !song.audioAnalysis || sameRecording(song.audioAnalysis, rich)) &&
    (!analysisSaveError || song.syncSource !== 'automatic') &&
    (!rich || sessionAudio?.hash === rich.pcmSha256) &&
    (song.syncSource !== 'automatic' || richTimingCurrent)
      ? song.syncTimes
      : null
  const synced = syncTimes !== null
  // Derive playback selection in this render. An effect that copied the clock
  // into state left the previous chord on screen for a frame at every change.
  const idx =
    synced && !recording && !listening
      ? stepAtTime(syncTimes, position)
      : practiceIdx

  // A trailing unrecognized span is evidence that the final mapped chord
  // stopped before the recording did. Keep its shape ready without saying Now.
  const trailingSilence = analysis?.chords.at(-1)
  const lastStart = syncTimes?.at(-1) ?? 0
  const sheetEnd =
    song.syncSource === 'automatic' &&
    analysis?.endTime != null &&
    analysis.endTime > lastStart
      ? analysis.endTime
      : trailingSilence?.label === 'N' && trailingSilence.start > lastStart
        ? trailingSilence.start
        : (analysis?.duration ?? audioDuration ?? Number.POSITIVE_INFINITY)

  // What sounds when: the synced sheet if we have it, else what was heard.
  const timedChords = useMemo(() => {
    const chords = !analysis
      ? []
      : syncTimes
        ? sheetChords(steps, syncTimes, sheetEnd)
        : analysis.chords.filter((chord) => chord.label !== 'N')
    if (!rich) return chords
    return chords.flatMap((chord) =>
      rich.analysis.harmony.flatMap((event) => {
        if (event.kind !== 'chord') return []
        const start = Math.max(chord.start, event.start),
          end = Math.min(chord.end, event.end)
        return start < end ? [{ ...chord, start, end }] : []
      }),
    )
  }, [analysis, syncTimes, steps, sheetEnd, rich])

  const now = steps[idx]
  const selectedOnly = Boolean(
    playbackSource && !syncTimes && !listening && !recording,
  )
  // A single-note passage intentionally has no chord; tab steps use note evidence.
  const unresolvedNow = rich
    ? now?.kind === 'notes'
      ? !(
          rich.analysis.monophonicNotes.some((note) =>
            sounds(note, position),
          ) ||
          rich.analysis.polyphonicNotes.some((note) => sounds(note, position))
        )
      : rich.analysis.harmony.some(
          (event) =>
            event.start <= position &&
            position < event.end &&
            event.kind !== 'chord',
        )
    : false
  const currentStepSounds =
    !unresolvedNow &&
    (listening ||
      !syncTimes ||
      !now ||
      (!mediaEnded &&
        sounds(
          {
            start: syncTimes[idx],
            end: syncTimes[idx + 1] ?? sheetEnd,
          },
          position,
        )))
  const stepStatus = selectedOnly
    ? 'Selected chord'
    : currentStepSounds
      ? now?.section
        ? `${now.section} · now`
        : 'Now'
      : position < (syncTimes?.[0] ?? 0)
        ? 'Get ready'
        : mediaEnded ||
            (analysis && position >= analysis.duration - 0.002) ||
            (audioDuration != null && position >= audioDuration - 0.002)
          ? 'Finished'
          : 'No chord now'

  // Lyrics follow audio estimates when the pasted sheet has no timing yet.
  // Keep a selected practice shape confined to the sheet view.
  const followingAudio =
    !steps.length ||
    Boolean(analysis && !synced && sheetView === 'lyrics' && !recording)
  const heardChord =
    followingAudio && (!rich || playback.ready)
      ? chordAt(timedChords, position)
      : undefined
  const comingChord = !followingAudio
    ? undefined
    : timedChords.find((chord) => chord.start > position)
  const heardLabel = !followingAudio
    ? undefined
    : (heardChord ?? comingChord ?? timedChords.at(-1))?.label
  const heardStatus = heardChord
    ? 'Heard now'
    : analysis && position >= analysis.duration - 0.002
      ? 'Finished'
      : position < (timedChords[0]?.start ?? 0)
        ? 'Get ready'
        : 'No chord now'
  const heardShape = useMemo(() => {
    if (!heardLabel) return null
    const shape = resolveChord(heardLabel)
    const identity = parseChordIdentity(heardLabel)
    return shape &&
      identity &&
      chordMidiNotes(shape.shape).every((m) =>
        chordPitchClasses(identity).includes(m % 12),
      ) &&
      chordPitchClasses(identity).every((pc) =>
        chordMidiNotes(shape.shape).some((m) => m % 12 === pc),
      )
      ? shape
      : null
  }, [heardLabel])

  // Video follow: a synced sheet tracks the shared clock while the video
  // plays — the same map lets sheet taps seek the video.
  const followVideo = synced && !recording && !listening

  // The runway runs on the song's clock while the video drives the sheet, and
  // walks the sheet one step at a time otherwise (unsynced, mic, tap-sync).
  const runwayUnit =
    !followingAudio && steps.length && !followVideo ? 'steps' : 'seconds'
  const runway = useMemo(() => {
    const noteEvidence = rich
      ? [...rich.analysis.monophonicNotes, ...rich.analysis.polyphonicNotes]
      : []
    const chordEvidence =
      rich?.analysis.harmony.filter((event) => event.kind === 'chord') ?? []
    const chords = followingAudio
      ? timedChords
      : followVideo && syncTimes
        ? sheetChords(steps, syncTimes, sheetEnd)
            .flatMap((span, index) => {
              if (!rich) return [span]
              // Keep unresolved gaps visible; tab notes use note evidence, not harmony.
              const evidence =
                steps[index].kind === 'notes' ? noteEvidence : chordEvidence
              return evidence.flatMap((event) => {
                const start = Math.max(span.start, event.start)
                const end = Math.min(span.end, event.end)
                return start < end ? [{ ...span, start, end }] : []
              })
            })
            .sort((a, b) => a.start - b.start)
        : steps.map((step, i) => ({
            label: step.chord.symbol,
            start: i,
            end: i + 1,
          }))
    const sections = followingAudio
      ? []
      : steps.flatMap((step, i) =>
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
  }, [
    steps,
    timedChords,
    followVideo,
    syncTimes,
    sheetEnd,
    followingAudio,
    rich,
  ])

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
      if (!steps.length || timingLyrics || followingAudio) return
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
    followingAudio,
  ])

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
    let micMatch = INITIAL_MIC_MATCH
    // Ignore the first beat after a step change so the tail of the previous
    // chord (often sharing notes) can't instantly trigger the next one.
    const armedAt = performance.now() + 700
    let advanced = false
    let advanceTimer: number | undefined

    const tick = () => {
      const frame = engine.mic.frame()
      const t = performance.now()
      if (!frame) micMatch = nextMicMatch(micMatch, null)
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
          micMatch = nextMicMatch(micMatch, score, t > armedAt)
          // Same thresholds as Listen mode: real strums plateau ~0.65-0.8,
          // wrong chords sit below 0.5; two frames filters pick transients.
          if (micMatch.framesAbove >= 2 && !advanced) {
            advanced = true
            setHit(true)
            onGlow(true)
            advanceTimer = window.setTimeout(() => advance(1), 650)
          }
        } else {
          micMatch = nextMicMatch(micMatch, 'silence')
        }
        setMatch(micMatch.smooth)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(advanceTimer)
    }
  }, [listening, idx, now, advance, onGlow])

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

  const stopMic = () => {
    micRequest.current++
    engine.mic.stop()
    setListening(false)
    setMatch(0)
    setHit(false)
    onGlow(false)
  }

  const toggleMic = async () => {
    if (listening) {
      stopMic()
      return
    }
    const requestId = ++micRequest.current
    try {
      setMicError(null)
      clock.pause()
      setIdx(idx)
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
  const nowName = followingAudio ? heardLabel : now?.chord.symbol
  const nowShape = followingAudio
    ? heardShape?.shape
    : now?.kind === 'notes' || now?.chord.approx
      ? null
      : now?.chord.shape
  const highlighted = followingAudio
    ? Boolean(heardChord)
    : currentStepSounds && !selectedOnly
  const hasPages = steps.length > 0 || Boolean(analysis)

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
          <div
            className={`chord-card${highlighted ? ' now' : ''}${!followingAudio && now?.kind === 'notes' ? ' note-step' : ''}${hit ? ' hit' : ''}`}
          >
            <span className="role">
              {followingAudio ? heardStatus : stepStatus}
            </span>
            <h2 className="chord-name">{nowName}</h2>
            {!followingAudio && now && (
              <p className="chord-notes">
                {now.kind === 'notes' ? 'notes:' : 'Sheet pitches:'}{' '}
                <strong>
                  {[
                    ...new Set(alignmentTarget(now).midis.map(midiToName)),
                  ].join(' · ')}
                </strong>
              </p>
            )}
            {nowShape && (
              <p className="recording-help">
                Suggested fingering · the recording does not reveal string or
                fret choices.
              </p>
            )}
            {nowShape && (
              <ChordDiagram
                shape={nowShape}
                accent={hit ? 'var(--moss)' : 'var(--ember)'}
                width={104}
              />
            )}
            {!followingAudio && now?.kind === 'notes' && (
              <TabBlock shape={now.chord.shape} />
            )}
            {!followingAudio && now?.chord.approx && (
              <p className="songbook-warn">Suggested fingering (approximate)</p>
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
            highlighted={highlighted}
          />
        </div>
      )}

      <div className={`player-body${hasPages ? '' : ' no-pages'}`}>
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
                  onClick={() => {
                    stopMic()
                    setSheetView('lyrics')
                  }}
                >
                  Lyrics & notes
                </button>
              </div>
            )}
            {analysis &&
              steps.length > 0 &&
              !synced &&
              !analyzing &&
              !recording &&
              !timingLyrics && (
                <div className="sheet-timing-note" role="status">
                  <p className="recording-help">
                    {sheetView === 'lyrics'
                      ? 'Following audio estimates. Your sheet still needs timing.'
                      : 'Your sheet is not synced to this recording yet.'}
                  </p>
                  <button className="quiet-btn" onClick={startRecording}>
                    Set sheet timing
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
                      current={currentStepSounds && !selectedOnly}
                      selected={selectedOnly}
                      band={
                        li >= litLine &&
                        li <= bandEnd &&
                        litLine >= 0 &&
                        highlighted
                      }
                      onJump={jumpTo}
                    />
                  ))}
                </div>
              </div>
            )}
            {analysis && song.youtubeId && (
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
            {rich && !song.youtubeId && analysis && (
              <div
                hidden={
                  recording || (steps.length > 0 && sheetView === 'sheet')
                }
              >
                <UploadLyrics
                  key={rich.pcmSha256}
                  identity={`upload:${rich.pcmSha256}`}
                  analysis={analysis}
                  saved={song.lyrics}
                  suggestedText={suggestedLyrics}
                  chords={timedChords}
                  clock={clock}
                  position={position}
                  ready={playback.ready}
                  onSave={(lyrics) => onUpdate({ lyrics })}
                  onTimingChange={setTimingLyrics}
                />
              </div>
            )}
          </div>
        )}

        <aside className="player-rail">
          {parsed.warnings.map((warning) => (
            <p className="songbook-warn" key={warning}>
              {warning}
            </p>
          ))}
          {playbackSource && (
            <SongVideo
              videoId={song.youtubeId}
              title={song.title}
              playback={playback}
            />
          )}

          <div className="songbook-analysis" hidden={recording}>
            {analysisSaveError && (
              <p className="songbook-warn" role="alert">
                {analysisSaveError}
              </p>
            )}
            {(() => {
              const receive = (
                saved: SavedAudioAnalysis,
                envelope: ResultEnvelope,
                audio: Blob,
              ) => {
                const previous = rich
                const recordingMatches =
                  !previous || sameRecording(previous, saved)
                const sameOptions =
                  !previous ||
                  (previous.analysis.engineVersion ===
                    saved.analysis.engineVersion &&
                    JSON.stringify(previous.analysis.options) ===
                      JSON.stringify(saved.analysis.options))
                const keepManual =
                  recordingMatches &&
                  song.syncSource !== 'automatic' &&
                  validSyncTimes(song.syncTimes, steps.length)
                const legacy =
                  saved.source.kind === 'youtube'
                    ? {
                        ...analysisProjection(saved.analysis),
                        version: VIDEO_ANALYSIS_VERSION,
                        videoId: saved.source.videoId,
                        sequenceKey: saved.sequenceKey,
                        syncReason: saved.alignment.reason,
                        times: saved.alignment.times,
                        endTime: saved.alignment.endTime,
                        transpose: saved.alignment.transpose,
                      }
                    : undefined
                const changes: Partial<Omit<SavedSong, 'id'>> = {
                  title:
                    song.title === 'Untitled song' && envelope.title
                      ? envelope.title
                      : song.title,
                  audioAnalysis: saved,
                  videoAnalysis: legacy,
                  uploadSource:
                    saved.source.kind === 'upload'
                      ? {
                          name: saved.source.name,
                          byteLength: saved.source.byteLength,
                          pcmSha256: saved.pcmSha256,
                        }
                      : undefined,
                  ...(!keepManual
                    ? {
                        syncTimes: saved.alignment.times ?? undefined,
                        syncSource: saved.alignment.times
                          ? 'automatic'
                          : undefined,
                      }
                    : {}),
                  ...(!recordingMatches ? { lyrics: undefined } : {}),
                }
                if (
                  !sameOptions &&
                  song.syncSource === 'automatic' &&
                  !saved.alignment.times
                ) {
                  changes.syncTimes = undefined
                  changes.syncSource = undefined
                }
                setSessionAnalysis(saved)
                setSessionAudio({ hash: saved.pcmSha256, audio })
                if (
                  new TextEncoder().encode(
                    JSON.stringify({ ...song, ...changes }),
                  ).length >
                  2 * 1024 * 1024
                ) {
                  setAnalysisSaveError(
                    'Detailed analysis is available in this session but exceeds the song save limit. Download its JSON below. Your saved song and manual timing were kept.',
                  )
                  return
                }
                setAnalysisSaveError(null)
                onUpdate(changes)
              }
              const common = {
                steps,
                playbackReady: playback.ready,
                saved: rich,
                initialFile,
                clock,
                position,
                syncSource: synced ? (song.syncSource ?? 'manual') : null,
                onSetTiming:
                  !timingLyrics && playback.ready ? startRecording : undefined,
                onBusy: (busy: boolean) => {
                  setAnalyzing(busy)
                  if (busy) setSessionAudio(null)
                },
                onResult: receive,
              }
              return song.youtubeId ? (
                <YouTubeAnalysisPanel {...common} videoId={song.youtubeId} />
              ) : (
                <AudioAnalysisPanel {...common} videoId={null} />
              )
            })()}
          </div>
        </aside>
      </div>

      {(playbackSource || now) && (
        <div className="player-bar">
          {playbackSource && (
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
            !followingAudio &&
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
  current,
  selected,
  band,
  onJump,
}: {
  line: SheetLine
  idx: number
  current: boolean
  selected: boolean
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
            className={`sheet-chord${seg.step === idx && current ? ' now' : ''}${seg.step === idx && selected ? ' selected' : ''}`}
            onClick={() => onJump(seg.step)}
            aria-label={`Jump to ${seg.text}`}
            aria-current={
              seg.step === idx && (current || selected) ? 'step' : undefined
            }
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

/** Upload lyrics reuse the existing parser/grouping, with no video-provider requests. */
function UploadLyrics({
  identity,
  analysis,
  saved,
  suggestedText,
  chords,
  clock,
  position,
  ready,
  onSave,
  onTimingChange,
}: {
  identity: string
  analysis: VideoAnalysis
  saved?: SongLyrics
  suggestedText: string
  chords: TimedChord[]
  clock: VideoClock
  position: number
  ready: boolean
  onSave: (lyrics: SongLyrics) => void
  onTimingChange: (marking: boolean) => void
}) {
  const lyrics = saved?.videoId === identity ? saved : undefined
  const [editing, setEditing] = useState(!lyrics)
  const [text, setText] = useState(lyrics?.text ?? suggestedText)
  const [marks, setMarks] = useState<number[] | null>(null)
  const pane = useRef<HTMLDivElement>(null)
  const parsed = parseLyrics(lyrics?.text ?? text, analysis.duration)
  const rows = lyrics?.cues
    ? lyricRows(lyrics.cues, chords, analysis.notes, analysis.duration)
    : []
  const current = rows.findIndex((row) => sounds(row, position))
  useEffect(() => {
    onTimingChange(marks !== null)
  }, [marks, onTimingChange])
  useEffect(() => {
    const element = pane.current?.querySelector<HTMLElement>(
      '[aria-current="true"]',
    )
    if (pane.current && element && clock.isPlaying())
      revealInPane(pane.current, element)
  }, [current, clock])
  const save = () => {
    const next = parseLyrics(text, analysis.duration)
    if (!next.lines.length) return
    onSave({
      videoId: identity,
      source: 'pasted',
      language: null,
      automatic: false,
      text,
      cues: next.cues,
    })
    setEditing(false)
  }
  const mark = () => {
    const time = clock.time()
    if (
      marks === null ||
      time === null ||
      !clock.isPlaying() ||
      time >= analysis.duration ||
      time <= (marks.at(-1) ?? -1)
    )
      return
    const next = [...marks, time]
    if (next.length < parsed.lines.length) {
      setMarks(next)
      return
    }
    onSave({
      videoId: identity,
      source: 'pasted',
      language: null,
      automatic: false,
      text: parsed.lines.join('\n'),
      cues: parsed.lines.map((line, i) => ({
        text: line,
        start: next[i],
        end: next[i + 1] ?? analysis.duration,
      })),
    })
    setMarks(null)
    clock.pause()
  }
  return (
    <section className="lyrics-sheet" aria-label="Upload lyrics and notes">
      <header className="lyrics-head">
        <h3>Lyrics & notes</h3>
        <button
          className="quiet-btn"
          onClick={() => {
            setText(lyrics?.text ?? suggestedText)
            setEditing(true)
            setMarks(null)
          }}
        >
          Edit lyrics
        </button>
      </header>
      {editing ? (
        <div className="lyrics-editor">
          <label htmlFor="upload-lyrics">
            Paste lyrics, one line at a time. LRC timestamps are supported.
          </label>
          <textarea
            id="upload-lyrics"
            className="songbook-paste"
            rows={8}
            maxLength={200_000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="lyrics-actions">
            <button className="play-btn" disabled={!text.trim()} onClick={save}>
              Save lyrics
            </button>
            <button className="quiet-btn" onClick={() => setEditing(false)}>
              Cancel editing
            </button>
          </div>
        </div>
      ) : (
        <>
          {lyrics && !lyrics.cues && marks === null && (
            <>
              <p className="recording-help">
                Your lyrics are saved. Mark each line to follow this recording.
              </p>
              <button
                className="play-btn"
                disabled={!ready}
                onClick={() => {
                  setMarks([])
                  clock.seek(0)
                  clock.play()
                }}
              >
                Time lyrics to song
              </button>
            </>
          )}
          {marks !== null && (
            <div className="lyrics-marking">
              <p>
                Tap as this line starts:{' '}
                <strong>{parsed.lines[marks.length]}</strong>
              </p>
              <button
                className="play-btn"
                disabled={!clock.playing}
                onClick={mark}
              >
                Mark line {marks.length + 1} of {parsed.lines.length}
              </button>
              <button
                className="quiet-btn"
                onClick={() => {
                  setMarks(null)
                  clock.pause()
                }}
              >
                Cancel timing
              </button>
            </div>
          )}
          <div className="lyrics-lines" ref={pane}>
            {rows.length
              ? rows.map((row, index) => (
                  <div
                    key={`${row.start}-${index}`}
                    className={`lyric-row${current === index ? ' active' : ''}`}
                    aria-current={current === index ? 'true' : undefined}
                  >
                    <button
                      className="lyric-words"
                      onClick={() => clock.seek(row.start)}
                    >
                      {row.text}
                    </button>
                    <div className="lyric-notes">
                      {row.held && (
                        <span
                          className={`held${current === index && sounds(row.held, position) ? ' sounding' : ''}`}
                          title="Still ringing from the line before"
                        >
                          {row.held.label} <small>held</small>
                        </span>
                      )}
                      {row.chords.map((chord, i) => (
                        <button
                          key={i}
                          onClick={() =>
                            clock.seek(Math.max(row.start, chord.start))
                          }
                          className={
                            current === index && sounds(chord, position)
                              ? 'sounding'
                              : undefined
                          }
                          aria-current={
                            current === index && sounds(chord, position)
                              ? 'time'
                              : undefined
                          }
                        >
                          {chord.label}{' '}
                        </button>
                      ))}
                      {row.notes.map((note, i) => (
                        <button
                          key={i}
                          className={
                            current === index && sounds(note, position)
                              ? 'sounding'
                              : undefined
                          }
                          onClick={() => clock.seek(note.start)}
                        >
                          {midiToNameWithOctave(note.midi)}{' '}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              : parsed.lines.map((line, index) => <p key={index}>{line}</p>)}
          </div>
        </>
      )}
    </section>
  )
}
