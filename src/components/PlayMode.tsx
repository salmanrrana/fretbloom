import { useEffect, useRef, useState } from 'react'
import { SONGS } from '../data/songs'
import { chordNoteNames } from '../data/chords'
import { engine } from '../audio/engine'
import { ChordDiagram } from './ChordDiagram'
import { TabBlock } from './TabBlock'

export function PlayMode() {
  const [songId, setSongId] = useState(SONGS[0].id)
  const [playing, setPlaying] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const progressRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  const song = SONGS.find((s) => s.id === songId)!
  const nowStep = song.steps[stepIndex % song.steps.length]
  const nextStep = song.steps[(stepIndex + 1) % song.steps.length]

  useEffect(() => {
    if (!playing) return
    const tick = () => {
      const pos = engine.player.position()
      setStepIndex((prev) => (pos.playing && pos.stepIndex !== prev ? pos.stepIndex : prev))
      if (progressRef.current) {
        progressRef.current.style.width = `${(pos.playing ? pos.stepProgress : 0) * 100}%`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing])

  useEffect(() => () => engine.player.stop(), [])

  const toggle = () => {
    if (playing) {
      engine.player.stop()
      setPlaying(false)
    } else {
      engine.player.play(song)
      setStepIndex(0)
      setPlaying(true)
    }
  }

  const pickSong = (id: string) => {
    setSongId(id)
    setStepIndex(0)
    if (playing) {
      const next = SONGS.find((s) => s.id === id)!
      engine.player.play(next)
    }
  }

  return (
    <section className="panel" aria-label="Play along">
      <p className="eyebrow">Play along</p>

      <div className="song-row">
        <select
          className="song-select"
          value={songId}
          onChange={(e) => pickSong(e.target.value)}
          aria-label="Choose a song"
        >
          {SONGS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} — {s.bpm} bpm
            </option>
          ))}
        </select>
        <button className="play-btn" onClick={toggle}>
          {playing ? 'Stop' : 'Play'}
        </button>
        <p className="song-vibe">{song.artistVibe}</p>
      </div>

      <div className="stage">
        <div className="chord-card now">
          <span className="role">Now playing</span>
          <h2 className="chord-name">{nowStep.chord.name}</h2>
          <p className="chord-notes">
            notes: <strong>{chordNoteNames(nowStep.chord).join(' · ')}</strong>
          </p>
          <ChordDiagram shape={nowStep.chord} accent="var(--ember)" />
          <TabBlock shape={nowStep.chord} />
          <div className="beat-track" aria-hidden="true">
            <div className="beat-fill" ref={progressRef} style={{ width: 0 }} />
          </div>
        </div>

        <span className="stage-arrow" aria-hidden="true">→</span>

        <div className="chord-card next">
          <span className="role">Up next</span>
          <h2 className="chord-name">{nextStep.chord.name}</h2>
          <p className="chord-notes">
            notes: <strong>{chordNoteNames(nextStep.chord).join(' · ')}</strong>
          </p>
          <ChordDiagram shape={nextStep.chord} accent="var(--petal)" />
          <TabBlock shape={nextStep.chord} />
        </div>
      </div>

      <div className="timeline" aria-label="Chord sequence">
        {song.steps.map((step, i) => {
          const cur = stepIndex % song.steps.length
          const nxt = (stepIndex + 1) % song.steps.length
          const cls = i === cur ? 'timeline-chip now' : i === nxt ? 'timeline-chip next' : 'timeline-chip'
          return (
            <span key={i} className={cls}>
              {step.chord.name}
            </span>
          )
        })}
      </div>
    </section>
  )
}
