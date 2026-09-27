import { useEffect, useMemo, useRef, useState } from 'react'
import { parseTab, youtubeId, type ParsedStep } from '../data/tabParser'
import {
  analysisSequenceKey,
  applyPendingSongChange,
  clearLocalSongbook,
  loadPendingSongChanges,
  loadRemoteSongbook,
  loadSongbook,
  saveRemoteSong,
  savePendingSongChanges,
  saveSongbook,
  SongConflictError,
  type PendingSongChange,
  type SavedSong,
} from '../data/songbook'
import { ChordDiagram } from './ChordDiagram'
import { SongbookPlayer } from './SongbookPlayer'
import { matchingSequence, validSyncTimes } from '../data/songSync'

const SAMPLE = `[Verse]
G        Cadd9
Em       D

[Chorus]
C   G   Am  F`
const MAX_TITLE_LENGTH = 300
const MAX_TAB_LENGTH = 200_000
const MAX_SONG_BYTES = 2 * 1024 * 1024
const SONG_ID = /^song-[a-z0-9-]{1,80}$/

// oxlint-disable-next-line react/only-export-components
export function songValidationError(
  song: SavedSong,
  allowLegacyId = false,
): string | null {
  if (!allowLegacyId && !SONG_ID.test(song.id))
    return 'This song has an invalid saved ID.'
  if (song.title.length > MAX_TITLE_LENGTH)
    return `Song titles must be ${MAX_TITLE_LENGTH} characters or fewer.`
  if (song.rawTab.length > MAX_TAB_LENGTH)
    return `Tabs must be ${MAX_TAB_LENGTH.toLocaleString()} characters or fewer.`
  if (song.steps.length > 20_000) return 'This tab has too many playable steps.'
  if (song.youtubeId && !/^[A-Za-z0-9_-]{11}$/.test(song.youtubeId))
    return 'This song has an invalid YouTube link.'
  if (!Number.isSafeInteger(song.savedAt) || song.savedAt <= 0)
    return 'This song has an invalid save date.'
  if (new TextEncoder().encode(JSON.stringify(song)).length > MAX_SONG_BYTES)
    return 'This song is too large to save.'
  return null
}

function sameSongContent(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => sameSongContent(value, b[index]))
    )
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left).filter((key) => key !== 'revision')
  return (
    keys.length ===
      Object.keys(right).filter((key) => key !== 'revision').length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) && sameSongContent(left[key], right[key]),
    )
  )
}

function localCopyId(song: SavedSong): string {
  let hash = 14_695_981_039_346_656_037n
  for (const byte of new TextEncoder().encode(JSON.stringify(song))) {
    hash ^= BigInt(byte)
    hash = BigInt.asUintN(64, hash * 1_099_511_628_211n)
  }
  return `song-local-${hash.toString(16).padStart(16, '0')}`
}

/** Plan migration before clearing browser storage; a colliding edit becomes a copy. */
// oxlint-disable-next-line react/only-export-components
export function localSongImports(
  remote: SavedSong[],
  cached: SavedSong[],
  newId: (song: SavedSong) => string = localCopyId,
): SavedSong[] {
  return cached.flatMap((song) => {
    const existing = remote.find((entry) => entry.id === song.id)
    if (existing && sameSongContent(existing, song)) return []
    const candidate: SavedSong = {
      ...song,
      id: existing || !SONG_ID.test(song.id) ? newId(song) : song.id,
      title:
        existing && song.title.length <= MAX_TITLE_LENGTH - 13
          ? `${song.title} (local copy)`
          : song.title,
      revision: 1,
    }
    const previousImport = remote.find((entry) => entry.id === candidate.id)
    return previousImport && sameSongContent(previousImport, candidate)
      ? []
      : [candidate]
  })
}

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

function withPendingChanges(
  songs: SavedSong[],
  changes: PendingSongChange[],
): SavedSong[] {
  return changes.reduce((current, change) => {
    if (change.kind === 'delete')
      return current.filter((song) => song.id !== change.id)
    const rest = current.filter((song) => song.id !== change.song.id)
    return [change.song, ...rest]
  }, songs)
}

export function SongbookMode({ onGlow }: Props) {
  const [songs, setSongs] = useState<SavedSong[]>(() => loadSongbook())
  // Event callbacks can run twice before React renders; writes use this latest snapshot.
  const songsRef = useRef(songs)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [saveConflict, setSaveConflict] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const remoteMode = useRef(false)
  const pending = useRef<PendingSongChange[]>([])
  const draining = useRef(false)
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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const remote = await loadRemoteSongbook()
        if (cancelled) return
        remoteMode.current = remote !== null
        if (remote !== null) {
          const cached = loadSongbook()
          let loaded = remote
          // Keep both versions when a local song shares an id with a different
          // remote song. Only clear browser storage after every import succeeds.
          if (cached.length > 0) {
            const imported = localSongImports(remote, cached)
            for (const candidate of imported) {
              const invalid = songValidationError(candidate)
              if (invalid)
                throw new Error(`Could not import a local song: ${invalid}`)
              await saveRemoteSong(candidate, 0)
            }
            if (cancelled) return
            loaded = [...remote, ...imported]
          }
          clearLocalSongbook()
          pending.current = loadPendingSongChanges()
          loaded = withPendingChanges(loaded, pending.current)
          songsRef.current = loaded
          setSongs(loaded)
          setBench(loaded.length === 0 ? { id: null } : null)
          if (pending.current.length) {
            setSaveError(true)
            void drain()
          }
        }
        setLoadError(false)
        setLoadErrorMessage(null)
      } catch (error) {
        if (!cancelled) {
          setLoadError(true)
          setLoadErrorMessage(error instanceof Error ? error.message : null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reload])

  const drain = async () => {
    if (draining.current) return
    draining.current = true
    try {
      while (pending.current.length) {
        try {
          const change = pending.current[0]
          await applyPendingSongChange(change)
          pending.current.shift()
          if (!savePendingSongChanges(pending.current)) setSaveError(true)
          else if (pending.current.length === 0) setSaveError(false)
        } catch (error) {
          setSaveError(true)
          setSaveConflict(error instanceof SongConflictError)
          break
        }
      }
    } finally {
      draining.current = false
    }
  }

  const queue = (change: PendingSongChange) => {
    if (!remoteMode.current) return
    pending.current.push(change)
    if (!savePendingSongChanges(pending.current)) setSaveError(true)
    void drain()
  }

  const persist = (makeNext: (current: SavedSong[]) => SavedSong[]) => {
    const current = songsRef.current
    const next = makeNext(current)
    const nextIds = new Set(next.map((song) => song.id))
    for (const song of next) {
      if (current.find((entry) => entry.id === song.id) === song) continue
      const invalid = songValidationError(song, !remoteMode.current)
      if (invalid) {
        setValidationError(invalid)
        return false
      }
    }
    setValidationError(null)
    for (const old of current) {
      if (!nextIds.has(old.id))
        queue({
          kind: 'delete',
          id: old.id,
          expectedRevision: old.revision ?? 0,
        })
    }
    for (const song of next) {
      const old = current.find((entry) => entry.id === song.id)
      if (old !== song) {
        queue({
          kind: 'put',
          song,
          expectedRevision: old?.revision ?? 0,
        })
      }
    }
    songsRef.current = next
    setSongs(next)
    if (!remoteMode.current) saveSongbook(next)
    return true
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
    const editorError =
      title.trim().length > MAX_TITLE_LENGTH
        ? `Song titles must be ${MAX_TITLE_LENGTH} characters or fewer.`
        : rawTab.length > MAX_TAB_LENGTH
          ? `Tabs must be ${MAX_TAB_LENGTH.toLocaleString()} characters or fewer.`
          : null
    if (editorError) {
      setValidationError(editorError)
      return
    }
    const currentEditing = bench?.id
      ? songsRef.current.find((song) => song.id === bench.id)
      : null
    const parsedSteps = preview?.steps ?? []
    const fields = {
      title: title.trim() || 'Untitled song',
      rawTab,
      youtubeId: previewVideo,
      steps: parsedSteps,
    }
    if (currentEditing) {
      // Same id and list position; the sync map survives only if it still fits.
      const { syncTimes, syncSource, videoAnalysis, lyrics, ...rest } =
        currentEditing
      const updated: SavedSong = syncStillFits(
        currentEditing,
        parsedSteps,
        previewVideo,
      )
        ? {
            ...rest,
            ...fields,
            syncTimes,
            syncSource,
            revision: (currentEditing.revision ?? 0) + 1,
          }
        : { ...rest, ...fields, revision: (currentEditing.revision ?? 0) + 1 }
      if (videoAnalysis?.videoId === previewVideo)
        updated.videoAnalysis = videoAnalysis
      // Restoring the original chord sequence can reuse its saved alignment.
      if (
        !updated.syncTimes &&
        videoAnalysis?.videoId === previewVideo &&
        videoAnalysis.sequenceKey === analysisSequenceKey(parsedSteps) &&
        validSyncTimes(videoAnalysis.times, parsedSteps.length)
      ) {
        updated.syncTimes = videoAnalysis.times
        updated.syncSource = 'automatic'
      }
      if (lyrics?.videoId === previewVideo) updated.lyrics = lyrics
      if (
        !persist((current) =>
          current.map((song) => (song.id === updated.id ? updated : song)),
        )
      )
        return
      setOpenId(updated.id)
    } else {
      const song: SavedSong = {
        id: `song-${crypto.randomUUID()}`,
        savedAt: Date.now(),
        revision: 1,
        ...fields,
      }
      if (!persist((current) => [song, ...current])) return
      setOpenId(song.id)
    }
    setBench(null)
  }

  const remove = (id: string) => {
    persist((current) => current.filter((song) => song.id !== id))
    if (openId === id) setOpenId(null)
  }

  const update = (changes: Partial<Omit<SavedSong, 'id'>>) => {
    persist((current) => {
      const currentSong = current.find((song) => song.id === openId)
      if (!currentSong) return current
      const changed = {
        ...currentSong,
        ...changes,
        revision: (currentSong.revision ?? 0) + 1,
      }
      return current.map((song) => (song.id === openId ? changed : song))
    })
  }

  const discardPendingAndLoadLatest = async () => {
    try {
      const remote = await loadRemoteSongbook()
      if (remote === null || !savePendingSongChanges([])) return
      pending.current = []
      songsRef.current = remote
      setSongs(remote)
      setOpenId(null)
      setBench(remote.length === 0 ? { id: null } : null)
      setSaveConflict(false)
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }

  // Unique chord symbols for the setlist run — the song's fingerprint. A song
  // without a sheet uses the chords heard in its video.
  const chordRun = (s: SavedSong) => {
    const symbols = s.steps.length
      ? s.steps.map((st) => st.chord.symbol)
      : (s.videoAnalysis?.chords ?? [])
          .map((chord) => chord.label)
          .filter((label) => label !== 'N')
    const uniq = [...new Set(symbols)]
    return uniq.length > 8
      ? `${uniq.slice(0, 8).join(' · ')} …`
      : uniq.join(' · ')
  }

  const pressedOn = (t: number) =>
    new Date(t).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })

  /** "11 chords · video linked · synced · pressed Sep 25" under each title. */
  const songMeta = (s: SavedSong) =>
    [
      s.steps.length
        ? `${s.steps.length} ${s.steps.some((st) => st.kind === 'notes') ? 'notes' : 'chords'}`
        : 'no sheet',
      s.youtubeId && 'video linked',
      s.syncTimes && 'synced',
      `pressed ${pressedOn(s.savedAt)}`,
    ]
      .filter(Boolean)
      .join(' · ')

  if (loading) return <p role="status">Loading your songs…</p>
  if (loadError)
    return (
      <section className="songbook-stage" aria-label="Songbook">
        <p role="alert">
          {loadErrorMessage ?? 'Could not load your songs from the database.'}
          {loadSongbook().length > 0 && ' Your browser copy is still saved.'}
        </p>
        <button
          onClick={() => {
            setLoading(true)
            setReload((value) => value + 1)
          }}
        >
          Try again
        </button>
        {loadSongbook().length > 0 && (
          <button
            onClick={() => {
              const local = loadSongbook()
              remoteMode.current = false
              songsRef.current = local
              setSongs(local)
              setBench(local.length === 0 ? { id: null } : null)
              setLoadError(false)
            }}
          >
            Open browser copy
          </button>
        )}
      </section>
    )

  const saveNotice = (
    <>
      {validationError && (
        <p role="alert" className="songbook-warn">
          {validationError}
        </p>
      )}
      {saveError && (
        <p role="alert" className="songbook-warn">
          {saveConflict ? (
            <>
              A song changed on another device. Your edits are still pending in
              this browser.{' '}
              <button onClick={() => void discardPendingAndLoadLatest()}>
                Discard all pending edits and load the latest songs
              </button>
              .
            </>
          ) : (
            <>
              Your latest changes have not reached the database. Keep this page
              open and{' '}
              <button onClick={() => void drain()}>retry saving</button>.
            </>
          )}
        </p>
      )}
    </>
  )

  if (bench) {
    return (
      <section className="songbook-stage" aria-label="Songbook">
        {saveNotice}
        <div className="songbook-editor">
          <header className="press-head">
            <h2 className="press-title">
              {editing ? `Edit “${editing.title}”` : 'Press a new song'}
            </h2>
            <p className="press-sub">
              {editing
                ? 'Fix the title, the tab, or the video link — the chords are re-read as you type. A recorded video sync stays as long as the chords still line up.'
                : 'Paste a YouTube link and we’ll hear its chords. Add the song’s chord sheet (or a six-string tab) and it lights up in time with the video.'}
            </p>
          </header>

          <div className="press-video-link">
            <label htmlFor="song-video-link">YouTube link</label>
            <input
              id="song-video-link"
              className="songbook-input press-input-video"
              placeholder="https://www.youtube.com/watch?v=…"
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
              onChange={(e) => {
                setRawTab(e.target.value)
                setValidationError(null)
              }}
              maxLength={MAX_TAB_LENGTH}
              rows={16}
              aria-label="Paste tab"
            />

            <div className="press-side">
              <input
                className="songbook-input press-input-title"
                placeholder={
                  previewVideo
                    ? 'Song title (or use the video’s)'
                    : 'Song title'
                }
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setValidationError(null)
                }}
                maxLength={MAX_TITLE_LENGTH}
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
                    A YouTube link is enough to hear the chords. Paste the
                    song’s chord sheet to follow it in time.
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
      <>
        {saveNotice}
        <SongbookPlayer
          key={open.id}
          song={open}
          onBack={() => setOpenId(null)}
          onEdit={() => openBench(open)}
          onGlow={onGlow}
          onUpdate={update}
        />
      </>
    )
  }

  return (
    <section className="songbook-stage" aria-label="Songbook">
      {saveNotice}
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
              <span className="songbook-meta">{songMeta(s)}</span>
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
