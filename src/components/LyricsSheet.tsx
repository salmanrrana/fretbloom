import { useEffect, useMemo, useRef, useState } from 'react'
import { midiToNameWithOctave } from '../audio/notes'
import type { VideoAnalysis } from '../data/songbook'
import {
  editedLyricCues,
  lyricRows,
  parseLyrics,
  readCaptions,
  type SongLyrics,
} from '../data/lyrics'
import type { VideoClock } from './useYouTubeClock'

interface Props {
  analysis: VideoAnalysis
  saved?: SongLyrics
  suggestedText: string
  clock: VideoClock
  onSave: (lyrics: SongLyrics) => void
  onTimingChange: (marking: boolean) => void
  onStartTiming: () => void
  focused: boolean
  onFocusChange: () => void
}

function timestamp(time: number): string {
  return `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`
}

export function LyricsSheet(props: Props) {
  const { analysis, saved, suggestedText, clock, onTimingChange } = props
  const latest = useRef(props)
  latest.current = props
  const [follow, setFollow] = useState(true)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(saved?.text ?? suggestedText)
  const [loading, setLoading] = useState(!saved)
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [marking, setMarking] = useState(false)
  const [marks, setMarks] = useState<number[]>([])
  const [position, setPosition] = useState(0)
  const request = useRef<AbortController | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const lyrics = saved?.videoId === analysis.videoId ? saved : undefined
  const parsed = useMemo(
    () => parseLyrics(lyrics?.text ?? text, analysis.duration),
    [lyrics?.text, text, analysis.duration],
  )
  const rows = useMemo(
    () =>
      lyrics?.cues
        ? lyricRows(lyrics.cues, analysis.notes, analysis.duration)
        : [],
    [lyrics, analysis],
  )
  const current = rows.findIndex(
    (row) => position >= row.start && position < row.end,
  )

  useEffect(() => {
    if (latest.current.saved?.videoId === analysis.videoId && attempt === 0) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setMessage('')
    const delay = window.setTimeout(() => {
      const deadline = window.setTimeout(
        () => controller.abort('timeout'),
        90_000,
      )
      void fetch(`/api/youtube-captions/${analysis.videoId}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          let result = response.ok
            ? readCaptions(await response.json(), analysis.duration)
            : null
          let source: SongLyrics['source'] = 'captions'
          if (result?.status !== 'available') {
            const lyricsResponse = await fetch(
              `/api/youtube-lyrics/${analysis.videoId}`,
              { signal: controller.signal },
            )
            if (!lyricsResponse.ok)
              throw new Error(
                'Lyrics could not be loaded right now. Try again or paste your lyrics.',
              )
            result = readCaptions(
              await lyricsResponse.json(),
              analysis.duration,
            )
            source = 'lyrics'
          }
          if (!result)
            throw new Error(
              'No readable lyrics were found. You can paste lyrics here.',
            )
          if (controller.signal.aborted) return
          if (result.status === 'available') {
            const next: SongLyrics = {
              videoId: analysis.videoId,
              source,
              language: result.language,
              automatic: result.automatic,
              cues: result.cues,
              text: result.cues.map((cue) => cue.text).join('\n'),
            }
            setText(next.text)
            latest.current.onSave(next)
          } else
            setMessage(
              'No timed lyrics or captions were found for this recording. Paste lyrics to add them here.',
            )
        })
        .catch((error: unknown) => {
          if (
            controller.signal.aborted &&
            controller.signal.reason !== 'timeout'
          )
            return
          setMessage(
            controller.signal.reason === 'timeout'
              ? 'Captions took too long to load. You can paste the lyrics below.'
              : error instanceof Error
                ? error.message
                : 'Video captions could not be loaded. You can paste the lyrics below.',
          )
        })
        .finally(() => {
          window.clearTimeout(deadline)
          if (request.current === controller) setLoading(false)
        })
    }, 300)
    return () => {
      window.clearTimeout(delay)
      controller.abort()
    }
  }, [analysis.videoId, analysis.duration, attempt])

  useEffect(() => {
    const tick = () => {
      const time = clock.time()
      if (time !== null) setPosition(time)
    }
    tick()
    const timer = window.setInterval(tick, 100)
    return () => window.clearInterval(timer)
  }, [clock])

  useEffect(() => {
    const container = sheet.current
    const row = container?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!follow || !container || !row || !clock.isPlaying()) return
    // Scroll the lyrics pane, never pull the entire page away from the video.
    if (
      row.offsetTop < container.scrollTop ||
      row.offsetTop + row.offsetHeight >
        container.scrollTop + container.clientHeight
    ) {
      container.scrollTop = Math.max(
        0,
        row.offsetTop - container.clientHeight / 3,
      )
    }
  }, [current, clock, follow])

  useEffect(() => {
    onTimingChange(marking)
  }, [marking, onTimingChange])

  const edit = () => {
    request.current?.abort()
    setLoading(false)
    // Edit the displayed cue order; old LRC markers must not undo manual timing.
    setText(
      lyrics?.cues
        ? lyrics.cues.map((cue) => cue.text).join('\n')
        : (lyrics?.text ?? suggestedText),
    )
    setEditing(true)
    setMarking(false)
    setMessage('')
  }
  const save = () => {
    const next = parseLyrics(text, analysis.duration)
    if (!next.lines.length) return
    const cues = editedLyricCues(text, analysis.duration, lyrics)
    latest.current.onSave({
      videoId: analysis.videoId,
      source: text === lyrics?.text ? lyrics.source : 'pasted',
      language: text === lyrics?.text ? lyrics.language : null,
      automatic: text === lyrics?.text ? lyrics.automatic : false,
      text,
      cues,
    })
    setEditing(false)
    setMessage(
      cues
        ? ''
        : 'Lyrics saved. Mark when each line starts to put the notes beside it.',
    )
  }
  const mark = () => {
    const time = clock.time()
    if (
      time === null ||
      !clock.isPlaying() ||
      time >= analysis.duration ||
      (marks.length > 0 && time <= marks[marks.length - 1])
    )
      return
    const next = [...marks, time]
    if (next.length < parsed.lines.length) {
      setMarks(next)
      return
    }
    latest.current.onSave({
      videoId: analysis.videoId,
      source: 'pasted',
      language: null,
      automatic: false,
      // Manual marks replace any old or incomplete LRC timestamps.
      text: parsed.lines.join('\n'),
      cues: parsed.lines.map((line, i) => ({
        text: line,
        start: next[i],
        end: next[i + 1] ?? analysis.duration,
      })),
    })
    setMarking(false)
    setMarks([])
    setMessage('Lyrics and notes are synced. Press play to follow along.')
    clock.pause()
  }

  return (
    <section className="lyrics-sheet" aria-label="Lyrics and notes">
      <header className="lyrics-head">
        <h3>Lyrics & notes</h3>
        <button className="quiet-btn" onClick={edit}>
          {lyrics ? 'Edit lyrics' : 'Paste lyrics'}
        </button>
      </header>
      {lyrics && !editing && (
        <div className="lyrics-reading-tools">
          <label>
            <input
              type="checkbox"
              checked={follow}
              onChange={(event) => setFollow(event.target.checked)}
            />{' '}
            Follow song
          </label>
          <button
            className="quiet-btn"
            aria-pressed={props.focused}
            onClick={props.onFocusChange}
          >
            {props.focused ? 'Show video' : 'Focus lyrics'}
          </button>
        </div>
      )}
      {loading && (
        <p className="recording-help" role="status">
          Finding lyrics for this recording…
        </p>
      )}
      {message && (
        <p className="recording-help" role="status">
          {message}
        </p>
      )}
      {editing ? (
        <div className="lyrics-editor">
          <label htmlFor="song-lyrics">
            One lyric line per line. Timed lyrics such as [00:12.50] are
            supported.
          </label>
          <textarea
            id="song-lyrics"
            className="songbook-paste"
            rows={8}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste lyrics here…"
          />
          <div className="lyrics-actions">
            <button className="play-btn" onClick={save} disabled={!text.trim()}>
              Save lyrics
            </button>
            <button className="quiet-btn" onClick={() => setEditing(false)}>
              Cancel editing
            </button>
          </div>
        </div>
      ) : (
        <>
          {lyrics && (
            <p className="recording-help">
              {lyrics.source === 'captions' ? (
                `${lyrics.automatic ? 'Auto-generated video captions' : 'Video captions'}${lyrics.language ? ` · ${lyrics.language}` : ''}`
              ) : lyrics.source === 'lyrics' ? (
                <a href="https://lrclib.net" target="_blank" rel="noopener">
                  Timed lyrics from LRCLIB
                </a>
              ) : (
                'Your lyrics'
              )}{' '}
              · Notes are estimates, grouped by line timing.
            </p>
          )}
          {!lyrics && !loading && (
            <p className="recording-help">
              The detected notes stay available below the video. Add lyrics to
              see both together.
            </p>
          )}
          {lyrics && !lyrics.cues && !marking && (
            <button
              className="play-btn"
              onClick={() => {
                // Manual timing owns the words and marks until it completes.
                request.current?.abort()
                setLoading(false)
                setMessage('')
                latest.current.onStartTiming()
                setMarks([])
                setMarking(true)
                clock.seek(0)
                clock.play()
              }}
            >
              Time lyrics to song
            </button>
          )}
          {marking && (
            <div className="lyrics-marking" role="status">
              <p>
                Tap as this line starts:{' '}
                <strong>{parsed.lines[marks.length]}</strong>
              </p>
              <div className="lyrics-actions">
                <button
                  className="play-btn"
                  onClick={mark}
                  disabled={!clock.playing}
                >
                  Mark line {marks.length + 1} of {parsed.lines.length}
                </button>
                <button
                  className="quiet-btn"
                  onClick={() => {
                    setMarking(false)
                    setMarks([])
                    clock.pause()
                  }}
                >
                  Cancel timing
                </button>
              </div>
            </div>
          )}
          {lyrics && (
            <div className="lyrics-lines" ref={sheet}>
              {rows.length
                ? rows.map((row, index) => (
                    <div
                      key={`${row.start}-${index}`}
                      className={`lyric-row${index === current ? ' active' : ''}${row.instrumental ? ' instrumental' : ''}`}
                      aria-current={index === current ? 'true' : undefined}
                    >
                      <button
                        className="lyric-words"
                        onClick={() => clock.seek(row.start)}
                      >
                        <span className="lyric-time">
                          {timestamp(row.start)}
                        </span>
                        <span>{row.text}</span>
                      </button>
                      <div
                        className="lyric-notes"
                        aria-label={`Notes for ${row.text}`}
                      >
                        {row.notes.length ? (
                          row.notes.map((note, n) => (
                            <button
                              key={n}
                              onClick={() => clock.seek(note.start)}
                              className={
                                position >= note.start && position < note.end
                                  ? 'sounding'
                                  : ''
                              }
                              aria-label={`${midiToNameWithOctave(note.midi)} at ${timestamp(note.start)}`}
                            >
                              {midiToNameWithOctave(note.midi)}
                            </button>
                          ))
                        ) : (
                          <span className="recording-help">
                            No clear notes detected in this line.
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                : parsed.lines.map((line, index) => (
                    <p
                      key={index}
                      className={`lyric-untimed${marking && index === marks.length ? ' active' : ''}`}
                    >
                      {line}
                    </p>
                  ))}
            </div>
          )}
          {!loading && (
            <button
              className="lyrics-caption-retry"
              onClick={() => {
                setMarking(false)
                setAttempt((value) => value + 1)
              }}
            >
              {lyrics ? 'Find lyrics again' : 'Try finding lyrics again'}
            </button>
          )}
        </>
      )}
    </section>
  )
}
