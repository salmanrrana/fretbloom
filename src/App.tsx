import { useCallback, useState } from 'react'
import { PlayMode } from './components/PlayMode'
import { TunerMode } from './components/TunerMode'
import { ListenMode } from './components/ListenMode'
import { SongbookMode } from './components/SongbookMode'

type Mode = 'tune' | 'play' | 'songbook' | 'listen'

const MODES: { id: Mode; label: string }[] = [
  { id: 'tune', label: 'Tune' },
  { id: 'play', label: 'Play along' },
  { id: 'songbook', label: 'Songbook' },
  { id: 'listen', label: 'Listen' },
]

export default function App() {
  const [mode, setMode] = useState<Mode>('tune')
  const [glow, setGlow] = useState(false)
  const onGlow = useCallback((lit: boolean) => setGlow(lit), [])

  return (
    <>
      <div className="bloom-field" aria-hidden="true">
        <div className="bloom a" />
        <div className="bloom b" />
        <div className="bloom c" />
        <div className={`bloom success${glow ? ' lit' : ''}`} />
      </div>

      <div className="shell">
        <header className="masthead">
          <h1 className="wordmark">fretbloom</h1>
          <p className="tagline">hear the chord · see the tab · let the room glow</p>
        </header>

        <nav className="modes" aria-label="Modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-btn${mode === m.id ? ' active' : ''}`}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
            >
              {m.label}
            </button>
          ))}
        </nav>

        {mode === 'play' && <PlayMode />}
        {mode === 'songbook' && <SongbookMode />}
        {mode === 'listen' && <ListenMode onGlow={onGlow} />}
        {mode === 'tune' && <TunerMode />}

        <p className="footnote">
          Headphones help in listen mode — otherwise the app hears itself. Everything runs in your browser; nothing is recorded or uploaded.
        </p>
      </div>
    </>
  )
}
