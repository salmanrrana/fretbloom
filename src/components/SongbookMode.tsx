import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  parseTab,
  stepMidiNotes,
  youtubeId,
  type ParsedStep,
  type SheetLine,
} from '../data/tabParser'
import { loadSongbook, saveSongbook, type SavedSong } from '../data/songbook'
import { midiToName } from '../audio/notes'
import { engine } from '../audio/engine'
import { chromaEnergies, chordMatchScore, detectPitch } from '../audio/pitch'
import { useSongPlayback } from './useSongPlayback'
import { SongPlayback } from './SongPlayback'
import { ChordDiagram } from './ChordDiagram'
import { TabBlock } from './TabBlock'
import { LyricsSheet } from './LyricsSheet'
import { YouTubeAnalysisPanel } from './YouTubeAnalysisPanel'
import { matchingSequence, validSyncTimes, stepAtTime } from '../data/songSync'

const SAMPLE = `[Verse]
G        Cadd9
Em       D

[Chorus]
C   G   Am  F`

interface Props {
  onGlow: (lit: boolean) => void
}

/**
 * A recorded video sync map only fits the chord sequence it was tapped
 * against, on the same video. Compares against the re-parsed original tab
 * because that is what the player walked while recording.
 */
function syncStillFits(
  song: SavedSong,
  steps: ParsedStep[],
  video: string | null,
): boolean {
  if (!song.syncTimes || song.youtubeId !== video) return false
  const before = parseTab(song.rawTab).steps
  return matchingSequence(before, steps)
}

export function SongbookMode({ onGlow }: Props) {
  const [songs, setSongs] = useState<SavedSong[]>(() => loadSongbook())
  const [openId, setOpenId] = useState<string | null>(null)
  // The press bench: null = closed, { id: null } = pressing a new song,
  // { id } = editing that saved song with its fields loaded in.
  const [bench, setBench] = useState<{ id: string | null } | null>(
    songs.length === 0 ? { id: null } : null,
  )

  // --- editor state ---
  const [title, setTitle] = useState('')
  const [rawTab, setRawTab] = useState('')
  const [videoUrl, setVideoUrl] = useState('')

  const preview = useMemo(
    () => (rawTab.trim() ? parseTab(rawTab) : null),
    [rawTab],
  )
  const previewVideo = useMemo(() => youtubeId(videoUrl), [videoUrl])

  const open = songs.find((s) => s.id === openId) ?? null
  const editing = bench?.id
    ? (songs.find((s) => s.id === bench.id) ?? null)
    : null

  const persist = (next: SavedSong[]) => {
    setSongs(next)
    saveSongbook(next)
  }

  /** Open the bench empty for a new song, or loaded with a saved one. */
  const openBench = (song: SavedSong | null) => {
    setTitle(song?.title ?? '')
    setRawTab(song?.rawTab ?? '')
    setVideoUrl(
      song?.youtubeId
        ? `https://www.youtube.com/watch?v=${song.youtubeId}`
        : '',
    )
    setBench({ id: song?.id ?? null })
  }

  const save = () => {
    if (!previewVideo && !preview?.steps.length) return
    const parsedSteps = preview?.steps ?? []
    const fields = {
      title: title.trim() || 'Untitled song',
      rawTab,
      youtubeId: previewVideo,
      steps: parsedSteps,
    }
    if (editing) {
      // Same id and list position; the sync map survives only if it still fits.
      const { syncTimes, syncSource, videoAnalysis, lyrics, ...rest } = editing
      const updated: SavedSong = syncStillFits(
        editing,
        parsedSteps,
        previewVideo,
      )
        ? { ...rest, ...fields, syncTimes, syncSource }
        : { ...rest, ...fields }
      if (videoAnalysis?.videoId === previewVideo)
        updated.videoAnalysis = videoAnalysis
      if (lyrics?.videoId === previewVideo) updated.lyrics = lyrics
      persist(songs.map((s) => (s.id === updated.id ? updated : s)))
      setOpenId(updated.id)
    } else {
      const song: SavedSong = {
        id: `song-${Date.now().toString(36)}`,
        savedAt: Date.now(),
        ...fields,
      }
      persist([song, ...songs])
      setOpenId(song.id)
    }
    setBench(null)
  }

  const remove = (id: string) => {
    persist(songs.filter((s) => s.id !== id))
    if (openId === id) setOpenId(null)
  }

  const update = (changes: Partial<Omit<SavedSong, 'id'>>) => {
    setSongs((current) => {
      const next = current.map((song) =>
        song.id === openId ? { ...song, ...changes } : song,
      )
      saveSongbook(next)
      return next
    })
  }

  // Unique chord symbols for the setlist run — the song's fingerprint.
  const chordRun = (s: SavedSong) => {
    const uniq = [...new Set(s.steps.map((st) => st.chord.symbol))]
    return uniq.length > 8
      ? `${uniq.slice(0, 8).join(' · ')} …`
      : uniq.join(' · ')
  }

  const pressedOn = (t: number) =>
    new Date(t).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })

  if (bench) {
    return (
      <section className="songbook-stage" aria-label="Songbook">
        <div className="songbook-editor">
          <header className="press-head">
            <h2 className="press-title">
              {editing ? `Edit “${editing.title}”` : 'Press a new song'}
            </h2>
            <p className="press-sub">
              {editing
                ? 'Fix the title, the tab, or the video link — the chords are re-read as you type. A recorded video sync stays as long as the chords still line up.'
                : 'Paste a YouTube link and we’ll find its notes automatically. Add a chord sheet or six-string guitar tab to sync the highlights to the video.'}
            </p>
          </header>

          <div className="press-video-link">
            <label htmlFor="song-video-link">YouTube link</label>
            <input
              id="song-video-link"
              className="songbook-input press-input-video"
              placeholder="YouTube link — finds notes and syncs your tab"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              aria-label="YouTube link"
            />
            {videoUrl.trim() && !previewVideo && (
              <p className="songbook-warn">
                That doesn't look like a YouTube link — the song will save
                without video.
              </p>
            )}
          </div>

          <div className="press-bench">
            <textarea
              className="songbook-paste"
              placeholder={`Optional: paste a chord sheet or guitar tab…\n\n${SAMPLE}`}
              value={rawTab}
              onChange={(e) => setRawTab(e.target.value)}
              rows={16}
              aria-label="Paste tab"
            />

            <div className="press-side">
              <input
                className="songbook-input press-input-title"
                placeholder="Song title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Song title"
              />

              <div className="press-preview" aria-live="polite">
                {preview ? (
                  <>
                    <p className="songbook-preview">
                      {preview.steps.length > 0 ? (
                        <>
                          Found{' '}
                          <strong>
                            {preview.steps.length}{' '}
                            {preview.steps.some((step) => step.kind === 'notes')
                              ? 'note events'
                              : 'chords'}
                          </strong>
                          :{' '}
                          {[
                            ...new Set(
                              preview.steps.map((s) => s.chord.symbol),
                            ),
                          ].join(' · ')}
                        </>
                      ) : (
                        'No playable steps found yet — paste chord names or a complete six-string tab.'
                      )}
                      {preview.unknown.length > 0 && (
                        <span className="songbook-warn">
                          {' '}
                          Couldn't read: {preview.unknown.join(', ')}
                        </span>
                      )}
                    </p>
                    {preview.warnings.map((warning) => (
                      <p className="songbook-warn" key={warning}>
                        {warning}
                      </p>
                    ))}
                    {preview.steps.length > 0 && (
                      <div
                        className="press-diagrams"
                        aria-label="Chord shapes found"
                      >
                        {[
                          ...new Map(
                            preview.steps.map((s) => [s.chord.symbol, s.chord]),
                          ).values(),
                        ]
                          .slice(0, 6)
                          .map((chord) => (
                            <figure key={chord.symbol} className="press-shape">
                              <ChordDiagram shape={chord.shape} width={72} />
                              <figcaption>{chord.symbol}</figcaption>
                            </figure>
                          ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="press-empty-hint">
                    A YouTube link is enough to find notes. Add a tab if you
                    want to follow along.
                  </p>
                )}
              </div>

              <div className="songbook-actions">
                <button
                  className="play-btn"
                  onClick={save}
                  disabled={!previewVideo && !preview?.steps.length}
                >
                  {editing
                    ? 'Save changes'
                    : previewVideo
                      ? 'Open YouTube song'
                      : 'Save song'}
                </button>
                {songs.length > 0 && (
                  <button
                    className="press-cancel"
                    onClick={() => setBench(null)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (open) {
    return (
      <SongbookPlayer
        key={open.id}
        song={open}
        onBack={() => setOpenId(null)}
        onEdit={() => openBench(open)}
        onGlow={onGlow}
        onUpdate={update}
      />
    )
  }

  return (
    <section className="songbook-stage" aria-label="Songbook">
      <header className="setlist-head">
        <h2 className="setlist-title">Songbook</h2>
        <p className="setlist-note">
          {songs.length} {songs.length === 1 ? 'song' : 'songs'} pressed — open
          one and play along
        </p>
      </header>

      <div className="songbook-list">
        {songs.map((s) => (
          <div key={s.id} className="songbook-item">
            <button className="songbook-open" onClick={() => setOpenId(s.id)}>
              <span className="songbook-title">{s.title}</span>
              <span className="songbook-chords">{chordRun(s)}</span>
              <span className="songbook-meta">
                {s.steps.length} steps{s.youtubeId ? ' · video linked' : ''}
                {s.syncTimes ? ' · synced' : ''} · pressed{' '}
                {pressedOn(s.savedAt)}
              </span>
            </button>
            <button
              className="songbook-edit"
              onClick={() => openBench(s)}
              aria-label={`Edit ${s.title}`}
            >
              edit
            </button>
            <button
              className="songbook-delete"
              onClick={() => remove(s.id)}
              aria-label={`Delete ${s.title}`}
            >
              ×
            </button>
          </div>
        ))}

        <button className="setlist-add" onClick={() => openBench(null)}>
          <span aria-hidden="true">+</span> press a new song
        </button>
      </div>
    </section>
  )
}

function SongbookPlayer({
  song,
  onBack,
  onEdit,
  onGlow,
  onUpdate,
}: {
  song: SavedSong
  onBack: () => void
  onEdit: () => void
  onGlow: (lit: boolean) => void
  onUpdate: (changes: Partial<Omit<SavedSong, 'id'>>) => void
}) {
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
  const [sheetView, setSheetView] = useState<'lyrics' | 'tab'>('lyrics')
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
  const [recording, setRecording] = useState(false)
  const [draft, setDraft] = useState<number[]>([])
  const syncTimes = validSyncTimes(song.syncTimes, steps.length)
    ? song.syncTimes
    : null
  const synced = Boolean(syncTimes)

  const now = steps[idx]
  const next = steps[(idx + 1) % steps.length]

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

  // Video follow: while the video plays a synced song, the sheet tracks the
  // video clock — the same map lets sheet taps seek the video.
  useEffect(() => {
    if (!synced || recording || !syncTimes || listening) return
    let raf = 0
    const tick = () => {
      const t = clock.time()
      if (t != null) setIdx(stepAtTime(syncTimes, t))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [synced, recording, syncTimes, clock, listening])

  // Keep the lit chord in view as the song moves along.
  useEffect(() => {
    sheetRef.current
      ?.querySelector(`[data-step="${idx}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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
              ? '→ / space: next · ←: back · tap any step'
              : 'Play the song · follow the lyrics and notes'}
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
                  aria-pressed={sheetView === 'lyrics'}
                  onClick={() => setSheetView('lyrics')}
                >
                  Lyrics & notes
                </button>
                <button
                  aria-pressed={sheetView === 'tab'}
                  onClick={() => setSheetView('tab')}
                >
                  Original tab
                </button>
              </div>
            )}
            {analysis && (
              <div
                hidden={recording || (steps.length > 0 && sheetView === 'tab')}
              >
                <LyricsSheet
                  key={analysis.videoId}
                  analysis={analysis}
                  saved={song.lyrics}
                  suggestedText={suggestedLyrics}
                  clock={clock}
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
                      onJump={jumpTo}
                    />
                  ))}
                </div>
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
            />
          )}

          {song.youtubeId && (
            <div hidden={recording}>
              <YouTubeAnalysisPanel
                videoId={song.youtubeId}
                steps={steps}
                saved={song.videoAnalysis}
                clock={clock}
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

          {song.youtubeId &&
            now &&
            !recording &&
            !analyzing &&
            !timingLyrics && (
              <div className="sync-row">
                {synced ? (
                  <p className="sync-status" aria-live="polite">
                    <span className="sync-dot" aria-hidden="true" />
                    synced to video — press play and the chords follow
                    <button className="sync-redo" onClick={startRecording}>
                      redo sync
                    </button>
                  </p>
                ) : (
                  <button className="sync-btn" onClick={startRecording}>
                    Set timing manually
                  </button>
                )}
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
              <p className="chord-notes">
                up next: <strong>{next.chord.symbol}</strong>
              </p>
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

function SheetLineView({
  line,
  idx,
  onJump,
}: {
  line: SheetLine
  idx: number
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
            className={`sheet-chord${seg.step === idx ? ' now' : ''}${seg.step === idx + 1 ? ' next' : ''}`}
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
}
