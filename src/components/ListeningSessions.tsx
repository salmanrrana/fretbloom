import { useEffect, useState } from 'react'
import {
  clearListeningSessions,
  deleteListeningSession,
  listListeningSessions,
  renameListeningSession,
} from '../data/listeningSessions'
import type { SavedListeningSession } from '../data/listeningSessions'
import { captureTime } from './LiveTimeline'

export function ListeningSessions({
  revision,
  disabled,
  onOpen,
}: {
  revision: number
  disabled: boolean
  onOpen: (session: SavedListeningSession) => void
}) {
  const [sessions, setSessions] = useState<SavedListeningSession[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  async function refresh() {
    setSessions(await listListeningSessions())
  }
  useEffect(() => {
    let active = true
    void listListeningSessions()
      .then((items) => {
        if (active) {
          setSessions(items)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Browser storage is unavailable.',
          )
      })
    return () => {
      active = false
    }
  }, [revision])
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Browser storage failed.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="live-sessions" aria-label="Saved listening sessions">
      <h3>Saved on this browser</h3>
      <p>
        Separate from Songbook. These sessions stay in this browser; clearing
        browser data can remove them. Nothing is uploaded or synced.
      </p>
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      {sessions.length === 0 && !error && <p>No sessions saved yet.</p>}
      <ul>
        {sessions.map((session) => (
          <li key={session.id}>
            <div>
              <strong>{session.title}</strong>
              <p>
                {captureTime(session.analysis.durationSamples / 24000)} ·{' '}
                {session.analysis.completeness} ·{' '}
                {session.pcm
                  ? `${(session.pcm.byteLength / 1048576).toFixed(1)} MiB audio`
                  : 'Results only'}
                <br />
                Engine {session.analysis.engineVersion}
              </p>
            </div>
            <div className="live-actions">
              <button
                disabled={disabled || busy}
                onClick={() => onOpen(session)}
              >
                Open
              </button>
              <button
                disabled={disabled || busy}
                onClick={() => {
                  setEditing(session.id)
                  setTitle(session.title)
                }}
              >
                Rename
              </button>
              <button
                disabled={disabled || busy}
                onClick={() => setDeleteConfirm(session.id)}
              >
                Delete
              </button>
            </div>
            {editing === session.id && (
              <form
                className="live-field-row"
                onSubmit={(event) => {
                  event.preventDefault()
                  void run(async () => {
                    await renameListeningSession(session.id, title.trim())
                    setEditing(null)
                  })
                }}
              >
                <label>
                  Session name
                  <input
                    autoFocus
                    maxLength={200}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                <button disabled={busy || !title.trim()}>Save name</button>
                <button type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </form>
            )}
            {deleteConfirm === session.id && (
              <div>
                <p>
                  Delete “{session.title}” and any retained audio from this
                  browser?
                </p>
                <div className="live-actions">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await deleteListeningSession(session.id)
                        setDeleteConfirm(null)
                      })
                    }
                  >
                    Delete this session
                  </button>
                  <button onClick={() => setDeleteConfirm(null)}>
                    Keep session
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {sessions.length > 0 && (
        <>
          <button
            disabled={disabled || busy}
            onClick={() => setClearConfirm(true)}
          >
            Clear saved sessions on this browser
          </button>
          {clearConfirm && (
            <div>
              <p>
                Delete all saved listening sessions and audio? Download anything
                you want to keep first.
              </p>
              <div className="live-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await clearListeningSessions()
                      setClearConfirm(false)
                    })
                  }
                >
                  Delete all saved sessions
                </button>
                <button onClick={() => setClearConfirm(false)}>
                  Keep sessions
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
