import { useCallback, useRef, useState } from 'react'
import { PlayMode } from './components/PlayMode'
import { TunerMode } from './components/TunerMode'
import { ListenMode } from './components/ListenMode'
import { SongbookMode } from './components/SongbookMode'

type Mode = 'tune' | 'play' | 'songbook' | 'listen'

const EXPERIMENTS: { id: Mode; label: string }[] = [
  { id: 'play', label: 'Play along' },
  { id: 'songbook', label: 'Songbook' },
  { id: 'listen', label: 'Listen' },
]

export default function App() {
  const [mode, setMode] = useState<Mode>('tune')
  const [greenhouse, setGreenhouse] = useState(false)
  const colorRef = useRef<HTMLDivElement>(null)
  const gardenRef = useRef<HTMLDivElement>(null)

  /**
   * The signature move: the flower wall blooms with tuning accuracy.
   * level 0 = muted wall, 1 = full color; inTune adds the breathing pulse.
   * Driven at rAF rate from the tuner, so it writes styles directly instead
   * of going through React state.
   */
  const onBloom = useCallback((level: number, inTune: boolean) => {
    const el = colorRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(1, level))
    el.style.opacity = String(clamped)
    el.style.clipPath = `circle(${(6 + clamped * 140).toFixed(1)}% at 50% 34%)`
    gardenRef.current?.classList.toggle('in-tune', inTune)
  }, [])

  /** Listen mode reuses the same wall: a hit is a full bloom. */
  const onGlow = useCallback(
    (lit: boolean) => onBloom(lit ? 1 : 0, lit),
    [onBloom],
  )

  const pick = (m: Mode) => {
    setMode(m)
    onBloom(0, false)
  }

  return (
    <>
      <div className="garden" ref={gardenRef} aria-hidden="true">
        <div className="garden-muted" />
        <div className="garden-color" ref={colorRef} />
        <div className="garden-vignette" />
      </div>

      <div className="shell">
        <header className="masthead">
          <div>
            <h1 className="wordmark">fretbloom</h1>
            <p className="tagline">tune it and the wall blooms</p>
          </div>

          <div className="greenhouse">
            {mode !== 'tune' && (
              <button className="ghost-btn" onClick={() => pick('tune')}>
                ← tuner
              </button>
            )}
            <button
              className={`ghost-btn greenhouse-toggle${greenhouse ? ' open' : ''}`}
              onClick={() => setGreenhouse((s) => !s)}
              aria-expanded={greenhouse}
              aria-label="Greenhouse — experimental features"
            >
              ⚘<span className="greenhouse-word">greenhouse</span>
            </button>
          </div>
        </header>

        {greenhouse && (
          <nav className="experiments" aria-label="Experimental modes">
            <p className="experiments-note">
              Experiments growing in the greenhouse — rough edges expected.
            </p>
            <div className="experiments-row">
              {EXPERIMENTS.map((m) => (
                <button
                  key={m.id}
                  className={`target-chip${mode === m.id ? ' active' : ''}`}
                  onClick={() => pick(m.id)}
                  aria-pressed={mode === m.id}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        {mode === 'tune' && <TunerMode onBloom={onBloom} />}
        {mode === 'play' && <PlayMode />}
        {mode === 'songbook' && <SongbookMode />}
        {mode === 'listen' && <ListenMode onGlow={onGlow} />}

        <p className="footnote">
          Everything runs in your browser; nothing is recorded or uploaded.
          {mode === 'listen' && ' Headphones help in listen mode — otherwise the app hears itself.'}
        </p>
      </div>
    </>
  )
}
