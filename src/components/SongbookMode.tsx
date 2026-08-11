import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseTab, youtubeId } from '../data/tabParser'
import { loadSongbook, saveSongbook, type SavedSong } from '../data/songbook'
import { chordNoteNames } from '../data/chords'
import { ChordDiagram } from './ChordDiagram'
import { TabBlock } from './TabBlock'

const SAMPLE = `[Verse]
G        Cadd9
Em       D

[Chorus]
C   G   Am  F`

export function SongbookMode() {
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

  if (open) {
    return <SongbookPlayer song={open} onBack={() => setOpenId(null)} />
  }

  return (
    <section className="panel" aria-label="Songbook">
      <p className="eyebrow">Songbook · paste a tab, follow along</p>

      {songs.length > 0 && (
        <div className="songbook-list">
          {songs.map((s) => (
            <div key={s.id} className="songbook-item">
              <button className="songbook-open" onClick={() => setOpenId(s.id)}>
                <span className="songbook-title">{s.title}</span>
                <span className="songbook-meta">
                  {s.steps.length} chords{s.youtubeId ? ' · video linked' : ''}
                </span>
              </button>
              <button className="songbook-delete" onClick={() => remove(s.id)} aria-label={`Delete ${s.title}`}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {!editing && (
        <button className="play-btn" onClick={() => setEditing(true)} style={{ marginTop: songs.length ? 16 : 0 }}>
          Add a song
        </button>
      )}

      {editing && (
        <div className="songbook-editor">
          <input
            className="songbook-input"
            placeholder="Song title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Song title"
          />
          <input
            className="songbook-input"
            placeholder="YouTube link (optional) — plays beside the chords"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            aria-label="YouTube link"
          />
          {videoUrl.trim() && !previewVideo && (
            <p className="songbook-warn">That doesn't look like a YouTube link — the song will save without video.</p>
          )}
          <textarea
            className="songbook-paste"
            placeholder={`Paste a chord tab here. Both common formats work:\n\n${SAMPLE}\n\n…or inline: [G]Here comes the [C]sun`}
            value={rawTab}
            onChange={(e) => setRawTab(e.target.value)}
            rows={10}
            aria-label="Paste tab"
          />
          {preview && (
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
          )}
          <div className="songbook-actions">
            <button className="play-btn" onClick={save} disabled={!preview || preview.steps.length === 0}>
              Save song
            </button>
            {songs.length > 0 && (
              <button className="mic-btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function SongbookPlayer({ song, onBack }: { song: SavedSong; onBack: () => void }) {
  const [idx, setIdx] = useState(0)
  const steps = song.steps
  const now = steps[idx]
  const next = steps[(idx + 1) % steps.length]

  const advance = useCallback(
    (dir: 1 | -1) => setIdx((i) => (i + dir + steps.length) % steps.length),
    [steps.length],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        advance(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        advance(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance])

  return (
    <section className="panel" aria-label={`Playing ${song.title}`}>
      <div className="songbook-player-head">
        <button className="mic-btn" onClick={onBack}>
          ← Songbook
        </button>
        <p className="eyebrow" style={{ margin: 0 }}>{song.title}</p>
        <p className="songbook-hint">→ / space: next chord · ←: back</p>
      </div>

      <div className={`songbook-stage${song.youtubeId ? ' with-video' : ''}`}>
        {song.youtubeId && (
          <div className="video-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${song.youtubeId}`}
              title={`${song.title} video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <div className="stage">
          <div className="chord-card now">
            <span className="role">{now.section ? `${now.section} · now` : 'Now'}</span>
            <h2 className="chord-name">{now.chord.symbol}</h2>
            {now.chord.approx && <p className="songbook-warn">closest playable shape</p>}
            <p className="chord-notes">
              notes: <strong>{chordNoteNames(now.chord.shape).join(' · ')}</strong>
            </p>
            <ChordDiagram shape={now.chord.shape} accent="var(--ember)" />
            <TabBlock shape={now.chord.shape} />
          </div>

          <span className="stage-arrow" aria-hidden="true">→</span>

          <div className="chord-card next">
            <span className="role">{next.section && next.section !== now.section ? `${next.section} · next` : 'Up next'}</span>
            <h2 className="chord-name">{next.chord.symbol}</h2>
            <p className="chord-notes">
              notes: <strong>{chordNoteNames(next.chord.shape).join(' · ')}</strong>
            </p>
            <ChordDiagram shape={next.chord.shape} accent="var(--petal)" />
            <TabBlock shape={next.chord.shape} />
          </div>
        </div>
      </div>

      <div className="songbook-nav">
        <button className="mic-btn" onClick={() => advance(-1)} aria-label="Previous chord">
          ← back
        </button>
        <button className="play-btn songbook-next" onClick={() => advance(1)}>
          next chord →
        </button>
      </div>

      <div className="timeline" aria-label="Full chord sequence">
        {steps.map((step, i) => {
          const cls = i === idx ? 'timeline-chip now' : i === (idx + 1) % steps.length ? 'timeline-chip next' : 'timeline-chip'
          return (
            <button key={i} className={`${cls} timeline-jump`} onClick={() => setIdx(i)}>
              {step.chord.symbol}
            </button>
          )
        })}
      </div>
    </section>
  )
}
