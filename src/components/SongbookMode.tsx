import { useMemo, useState } from 'react'
import { parseTab, youtubeId, type ParsedStep } from '../data/tabParser'
import { loadSongbook, saveSongbook, type SavedSong } from '../data/songbook'
import { ChordDiagram } from './ChordDiagram'
import { SongbookPlayer } from './SongbookPlayer'
import { matchingSequence } from '../data/songSync'

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
