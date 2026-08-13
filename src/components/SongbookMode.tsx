import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseTab, youtubeId, type SheetLine } from '../data/tabParser'
import { loadSongbook, saveSongbook, type SavedSong } from '../data/songbook'
import { chordNoteNames, chordPitchClasses } from '../data/chords'
import { engine } from '../audio/engine'
import { chromaEnergies, chordMatchScore } from '../audio/pitch'
import { useYouTubeClock } from './useYouTubeClock'
import { ChordDiagram } from './ChordDiagram'
import { TabBlock } from './TabBlock'

const SAMPLE = `[Verse]
G        Cadd9
Em       D

[Chorus]
C   G   Am  F`

interface Props {
  onGlow: (lit: boolean) => void
}

export function SongbookMode({ onGlow }: Props) {
  const [songs, setSongs] = useState<SavedSong[]>(() => loadSongbook())
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(songs.length === 0)

  // --- editor state ---
  const [title, setTitle] = useState('')
  const [rawTab, setRawTab] = useState('')
  const [videoUrl, setVideoUrl] = useState('')

  const preview = useMemo(() => (rawTab.trim() ? parseTab(rawTab) : null), [rawTab])
  const previewVideo = useMemo(() => youtubeId(videoUrl), [videoUrl])

  const open = songs.find((s) => s.id === openId) ?? null

  const persist = (next: SavedSong[]) => {
    setSongs(next)
    saveSongbook(next)
  }

  const save = () => {
    if (!preview || preview.steps.length === 0) return
    const song: SavedSong = {
      id: `song-${Date.now().toString(36)}`,
      title: title.trim() || 'Untitled song',
      rawTab,
      youtubeId: previewVideo,
      steps: preview.steps,
      savedAt: Date.now(),
    }
    persist([song, ...songs])
    setTitle('')
    setRawTab('')
    setVideoUrl('')
    setEditing(false)
    setOpenId(song.id)
  }

  const remove = (id: string) => {
    persist(songs.filter((s) => s.id !== id))
    if (openId === id) setOpenId(null)
  }

  const update = (updated: SavedSong) => {
    persist(songs.map((s) => (s.id === updated.id ? updated : s)))
  }

  if (open) {
    return <SongbookPlayer song={open} onBack={() => setOpenId(null)} onGlow={onGlow} onUpdate={update} />
  }

  // Unique chord symbols for the setlist run — the song's fingerprint.
  const chordRun = (s: SavedSong) => {
    const uniq = [...new Set(s.steps.map((st) => st.chord.symbol))]
    return uniq.length > 8 ? `${uniq.slice(0, 8).join(' · ')} …` : uniq.join(' · ')
  }

  const pressedOn = (t: number) =>
    new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  if (editing) {
    return (
      <section className="songbook-stage" aria-label="Songbook">
        <div className="songbook-editor">
          <header className="press-head">
            <h2 className="press-title">Press a new song</h2>
            <p className="press-sub">
              Paste any chord tab — chord lines over the lyrics, or inline like [G]Here comes the [C]sun. The
              chords are read as you type.
            </p>
          </header>

          <div className="press-bench">
            <textarea
              className="songbook-paste"
              placeholder={`Paste a chord tab here…\n\n${SAMPLE}`}
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
              <input
                className="songbook-input press-input-video"
                placeholder="YouTube link — optional, plays beside the chords"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                aria-label="YouTube link"
              />
              {videoUrl.trim() && !previewVideo && (
                <p className="songbook-warn">
                  That doesn't look like a YouTube link — the song will save without video.
                </p>
              )}

              <div className="press-preview" aria-live="polite">
                {preview ? (
                  <>
                    <p className="songbook-preview">
                      {preview.steps.length > 0 ? (
                        <>
                          Found <strong>{preview.steps.length} chords</strong>:{' '}
                          {[...new Set(preview.steps.map((s) => s.chord.symbol))].join(' · ')}
                        </>
                      ) : (
                        'No chords found yet — paste a tab with chord names.'
                      )}
                      {preview.unknown.length > 0 && (
                        <span className="songbook-warn"> Couldn't read: {preview.unknown.join(', ')}</span>
                      )}
                    </p>
                    {preview.steps.length > 0 && (
                      <div className="press-diagrams" aria-label="Chord shapes found">
                        {[...new Map(preview.steps.map((s) => [s.chord.symbol, s.chord])).values()]
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
                  <p className="press-empty-hint">The chords you paste appear here, shapes and all.</p>
                )}
              </div>

              <div className="songbook-actions">
                <button className="play-btn" onClick={save} disabled={!preview || preview.steps.length === 0}>
                  Save song
                </button>
                {songs.length > 0 && (
                  <button className="press-cancel" onClick={() => setEditing(false)}>
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

  return (
    <section className="songbook-stage" aria-label="Songbook">
      <header className="setlist-head">
        <h2 className="setlist-title">Songbook</h2>
        <p className="setlist-note">
          {songs.length} {songs.length === 1 ? 'song' : 'songs'} pressed — open one and play along
        </p>
      </header>

      <div className="songbook-list">
        {songs.map((s) => (
          <div key={s.id} className="songbook-item">
            <button className="songbook-open" onClick={() => setOpenId(s.id)}>
              <span className="songbook-title">{s.title}</span>
              <span className="songbook-chords">{chordRun(s)}</span>
              <span className="songbook-meta">
                {s.steps.length} chords{s.youtubeId ? ' · video linked' : ''}
                {s.syncTimes ? ' · synced' : ''} · pressed {pressedOn(s.savedAt)}
              </span>
            </button>
            <button className="songbook-delete" onClick={() => remove(s.id)} aria-label={`Delete ${s.title}`}>
              ×
            </button>
          </div>
        ))}

        <button className="setlist-add" onClick={() => setEditing(true)}>
          <span aria-hidden="true">+</span> press a new song
        </button>
      </div>
    </section>
  )
}

function SongbookPlayer({
  song,
  onBack,
  onGlow,
  onUpdate,
}: {
  song: SavedSong
  onBack: () => void
  onGlow: (lit: boolean) => void
  onUpdate: (song: SavedSong) => void
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

  // --- video sync ---
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const clock = useYouTubeClock(iframeRef, Boolean(song.youtubeId))
  const [recording, setRecording] = useState(false)
  const [draft, setDraft] = useState<number[]>([])
  const syncTimes = song.syncTimes && song.syncTimes.length >= steps.length ? song.syncTimes : null
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
    if (t == null) return
    const nextDraft = [...draft, t]
    if (nextDraft.length >= steps.length) {
      onUpdate({ ...song, syncTimes: nextDraft })
      setRecording(false)
      setDraft([])
      setIdx(0)
      clock.pause()
      return
    }
    setDraft(nextDraft)
    setIdx(nextDraft.length)
  }, [clock, draft, steps.length, song, onUpdate])

  const startRecording = () => {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        if (recording) tapSync()
        else advance(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (!recording) advance(-1)
      } else if (e.key === 'Escape' && recording) {
        cancelRecording()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, recording, tapSync, cancelRecording])

  // Video follow: while the video plays a synced song, the sheet tracks the
  // video clock — the same map lets sheet taps seek the video.
  useEffect(() => {
    if (!synced || recording || !syncTimes) return
    let raf = 0
    const tick = () => {
      if (clock.isPlaying()) {
        const t = clock.time()
        if (t != null) {
          let i = 0
          while (i + 1 < syncTimes.length && syncTimes[i + 1] <= t) i++
          setIdx(i)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [synced, recording, syncTimes, clock])

  const jumpTo = useCallback(
    (i: number) => {
      setIdx(i)
      if (syncTimes && !recording) clock.seek(syncTimes[i])
    },
    [syncTimes, recording, clock],
  )

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
    const pcs = chordPitchClasses(now.chord.shape)
    let raf = 0
    let lastChroma = 0
    let smooth = 0
    let framesAbove = 0
    // Ignore the first beat after a step change so the tail of the previous
    // chord (often sharing notes) can't instantly trigger the next one.
    const armedAt = performance.now() + 700
    let advanced = false

    const tick = () => {
      const frame = engine.mic.frame()
      const t = performance.now()
      if (frame && t - lastChroma > 100) {
        lastChroma = t
        let rms = 0
        for (let i = 0; i < frame.length; i++) rms += frame[i] * frame[i]
        rms = Math.sqrt(rms / frame.length)
        if (rms > 0.01) {
          const score = chordMatchScore(chromaEnergies(frame, engine.ctx.sampleRate), pcs)
          smooth = smooth * 0.5 + score * 0.5
          // Same thresholds as Listen mode: real strums plateau ~0.65-0.8,
          // wrong chords sit below 0.5; two frames filters pick transients.
          if (t > armedAt && smooth > 0.58) {
            framesAbove++
            if (framesAbove >= 2 && !advanced) {
              advanced = true
              setHit(true)
              onGlow(true)
              window.setTimeout(() => advance(1), 650)
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
    return () => cancelAnimationFrame(raf)
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
      engine.mic.stop()
      onGlow(false)
    },
    [onGlow],
  )

  const toggleMic = async () => {
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
      await engine.mic.start()
      setListening(true)
    } catch {
      setMicError('Microphone access was blocked. Allow the mic in your browser bar, then try again.')
    }
  }

  if (!now) {
    return (
      <section className="songbook-stage" aria-label={`Playing ${song.title}`}>
        <button className="songbook-back" onClick={onBack}>← Songbook</button>
        <p className="songbook-warn" style={{ marginTop: 12 }}>No chords found in this song's tab.</p>
      </section>
    )
  }

  return (
    <section className="songbook-stage" aria-label={`Playing ${song.title}`}>
      <div className="songbook-player-head">
        <button className="songbook-back" onClick={onBack}>
          ← Songbook
        </button>
        <h2 className="player-title">{song.title}</h2>
        <p className="songbook-hint">
          {recording ? 'space: mark the chord · esc: cancel' : '→ / space: next · ←: back · tap any chord'}
        </p>
      </div>

      <div className="songbook-follow">
        <div className="sheet" ref={sheetRef} aria-label="Full tab">
          {parsed.lines.map((line, li) => (
            <SheetLineView key={li} line={line} idx={idx} onJump={jumpTo} />
          ))}
        </div>

        <aside className="songbook-side">
          {song.youtubeId && (
            <div className="video-frame">
              <iframe
                ref={iframeRef}
                src={`https://www.youtube-nocookie.com/embed/${song.youtubeId}?enablejsapi=1`}
                title={`${song.title} video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {song.youtubeId && !recording && (
            <div className="sync-row">
              {synced ? (
                <p className="sync-status" aria-live="polite">
                  <span className="sync-dot" aria-hidden="true" />
                  synced to video — press play and the chords follow
                  <button className="sync-redo" onClick={startRecording}>redo sync</button>
                </p>
              ) : (
                <button className="sync-btn" onClick={startRecording}>
                  Sync chords to the video
                </button>
              )}
            </div>
          )}

          {recording && (
            <div className="sync-recording" aria-live="polite">
              <p className="sync-status recording">
                <span className="sync-dot rec" aria-hidden="true" />
                video is playing — tap when <strong>{now.chord.symbol}</strong> hits
                <span className="sync-count">{draft.length}/{steps.length}</span>
              </p>
              <div className="songbook-nav">
                <button className="play-btn songbook-next" onClick={tapSync}>
                  {now.chord.symbol} now
                </button>
                <button className="quiet-btn" onClick={cancelRecording}>cancel</button>
              </div>
            </div>
          )}

          <div className={`chord-card now${hit ? ' hit' : ''}`}>
            <span className="role">{now.section ? `${now.section} · now` : 'Now'}</span>
            <h2 className="chord-name">{now.chord.symbol}</h2>
            {now.chord.approx && <p className="songbook-warn">closest playable shape</p>}
            <p className="chord-notes">
              notes: <strong>{chordNoteNames(now.chord.shape).join(' · ')}</strong>
            </p>
            <ChordDiagram shape={now.chord.shape} accent={hit ? 'var(--moss)' : 'var(--ember)'} />
            <TabBlock shape={now.chord.shape} />
            <p className="chord-notes">
              up next: <strong>{next.chord.symbol}</strong>
            </p>
          </div>

          {!recording && (
            <>
              <div className="songbook-nav">
                <button className="quiet-btn" onClick={() => advance(-1)} aria-label="Previous chord">
                  ←
                </button>
                <button className="play-btn songbook-next" onClick={() => advance(1)}>
                  next →
                </button>
              </div>

              <button className={`quiet-btn songbook-listen${listening ? ' live' : ''}`} onClick={toggleMic}>
                {listening ? 'Stop listening' : 'Listen to me play'}
              </button>
              {listening && (
                <div className="match-meter" role="progressbar" aria-valuenow={Math.round(match * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Chord match">
                  <div className="match-fill" style={{ width: `${Math.min(100, match * 120)}%` }} />
                </div>
              )}
              <p className="listen-status songbook-listen-status">
                {micError
                  ? micError
                  : listening
                    ? hit
                      ? <strong>{now.chord.symbol} is ringing — moving on.</strong>
                      : `Strum ${now.chord.symbol} — the sheet follows you.`
                    : 'Turn the mic on and the song advances as you play.'}
              </p>
            </>
          )}
        </aside>
      </div>
    </section>
  )
}

function SheetLineView({ line, idx, onJump }: { line: SheetLine; idx: number; onJump: (i: number) => void }) {
  if (line.kind === 'blank') return <div className="sheet-line blank">&nbsp;</div>
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
