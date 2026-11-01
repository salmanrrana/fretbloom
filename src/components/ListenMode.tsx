import { useState } from 'react'
import { LiveListen } from './LiveListen'
import { PracticeChordMode } from './PracticeChordMode'
import './live-listen.css'

export function ListenMode({ onGlow }: { onGlow: (lit: boolean) => void }) {
  const [view, setView] = useState<'capture' | 'practice'>('capture')
  return (
    <>
      <div
        className="live-mode-switch"
        role="group"
        aria-label="Listening mode"
      >
        <button
          className={`target-chip${view === 'capture' ? ' active' : ''}`}
          aria-pressed={view === 'capture'}
          onClick={() => setView('capture')}
        >
          Capture music
        </button>
        <button
          className={`target-chip${view === 'practice' ? ' active' : ''}`}
          aria-pressed={view === 'practice'}
          onClick={() => setView('practice')}
        >
          Practice a chord
        </button>
      </div>
      {view === 'capture' ? (
        <LiveListen />
      ) : (
        <PracticeChordMode onGlow={onGlow} />
      )}
    </>
  )
}
