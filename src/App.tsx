import { useCallback, useState } from 'react'
import { PlayMode } from './components/PlayMode'
import { TunerMode } from './components/TunerMode'
import { ListenMode } from './components/ListenMode'
import { SongbookMode } from './components/SongbookMode'

type Mode = 'tune' | 'play' | 'songbook' | 'listen'

const MODES: { id: Mode; label: string; experimental: boolean }[] = [
  { id: 'tune', label: 'Tune', experimental: false },
  { id: 'play', label: 'Play along', experimental: true },
  { id: 'songbook', label: 'Songbook', experimental: true },
  { id: 'listen', label: 'Listen', experimental: true },
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
          <p className="tagline">the tuner that gets out of your way</p>
        </header>

        <nav className="modes" aria-label="Modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-btn${mode === m.id ? ' active' : ''}${m.experimental ? ' experimental' : ''}`}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
            >
              {m.label}
              {m.experimental && <sup className="flask" aria-label="experimental">⚗</sup>}
            </button>
          ))}
        </nav>

        {MODES.find((m) => m.id === mode)!.experimental && (
          <p className="experimental-banner" role="note">
            <strong>Work in progress.</strong> This mode is an experiment — expect rough edges.
            The tuner is the heart of fretbloom.
          </p>
        )}

        {mode === 'play' && <PlayMode />}
        {mode === 'songbook' && <SongbookMode />}
        {mode === 'listen' && <ListenMode onGlow={onGlow} />}
        {mode === 'tune' && <TunerMode />}

        <p className="footnote">
          Everything runs in your browser; nothing is recorded or uploaded.
          {mode === 'listen' && ' Headphones help in listen mode — otherwise the app hears itself.'}
        </p>
      </div>
    </>
  )
}
