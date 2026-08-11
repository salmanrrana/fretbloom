import { useEffect, useRef, useState } from 'react'
import { CHORDS, chordPitchClasses, chordNoteNames } from '../data/chords'
import { engine } from '../audio/engine'
import { chromaEnergies, chordMatchScore, detectPitch } from '../audio/pitch'
import { readPitch } from '../audio/notes'
import { ChordDiagram } from './ChordDiagram'
import { TabBlock } from './TabBlock'

const TARGETS = ['G', 'C', 'D', 'Em', 'Am', 'E', 'A', 'F'] as const

interface Props {
  onGlow: (lit: boolean) => void
}

export function ListenMode({ onGlow }: Props) {
  const [live, setLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState<keyof typeof CHORDS>('G')
  const [match, setMatch] = useState(0)
  const [heard, setHeard] = useState<string | null>(null)
  const [hit, setHit] = useState(false)
  const rafRef = useRef(0)
  const smooth = useRef(0)
  const hitUntil = useRef(0)
  const lastChroma = useRef(0)
  const framesAbove = useRef(0)

  const shape = CHORDS[target]

  useEffect(() => {
    if (!live) return
    const pcs = chordPitchClasses(shape)
    const tick = () => {
      const frame = engine.mic.frame()
      const now = performance.now()
      if (frame) {
        // Pitch every frame (cheap); chroma at ~10 Hz (heavier).
        const freq = detectPitch(frame, engine.ctx.sampleRate)
        setHeard(freq ? readPitch(freq).nameWithOctave : null)

        if (now - lastChroma.current > 100) {
          lastChroma.current = now
          let rms = 0
          for (let i = 0; i < frame.length; i++) rms += frame[i] * frame[i]
          rms = Math.sqrt(rms / frame.length)
          if (rms > 0.01) {
            const score = chordMatchScore(chromaEnergies(frame, engine.ctx.sampleRate), pcs)
            smooth.current = smooth.current * 0.5 + score * 0.5
            // Real strums leak harmonic energy into off-chord pitch classes,
            // so a perfect take plateaus around 0.65-0.8; wrong chords sit
            // below 0.5. Requiring two consecutive frames above threshold
            // filters the attack transient, which briefly scores high while
            // pick noise dominates.
            if (smooth.current > 0.58) {
              framesAbove.current++
              if (framesAbove.current >= 2) hitUntil.current = now + 900
            } else {
              framesAbove.current = 0
            }
          } else {
            smooth.current *= 0.9
          }
          setMatch(smooth.current)
        }
      }
      const isHit = now < hitUntil.current
      setHit(isHit)
      onGlow(isHit)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [live, shape, onGlow])

  useEffect(
    () => () => {
      engine.mic.stop()
      onGlow(false)
    },
    [onGlow],
  )

  const toggle = async () => {
    if (live) {
      engine.mic.stop()
      setLive(false)
      setHit(false)
      setMatch(0)
      onGlow(false)
      return
    }
    try {
      setError(null)
      await engine.mic.start()
      setLive(true)
    } catch {
      setError('Microphone access was blocked. Allow the mic in your browser bar, then try again.')
    }
  }

  return (
    <section className="panel" aria-label="Listen mode">
      <p className="eyebrow">Listen · play the chord, light the room</p>

      <div className="listen-stage">
        <div>
          <p className="chord-notes">
            Target chord — strum it and hold. Notes: <strong>{chordNoteNames(shape).join(' · ')}</strong>
          </p>

          <p className={`big-glow-note${hit ? ' hit' : ''}`}>{shape.name}</p>

          <div className="match-meter" role="progressbar" aria-valuenow={Math.round(match * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Chord match">
            <div className="match-fill" style={{ width: `${Math.min(100, match * 120)}%` }} />
          </div>

          <p className="listen-status">
            {error
              ? error
              : !live
                ? 'Turn the mic on, pick a chord, and strum.'
                : hit
                  ? <strong>That's it — {shape.name} is ringing. Beautiful.</strong>
                  : 'Listening…'}
          </p>
          <p className="heard-note">{live && heard ? `strongest note heard: ${heard}` : ' '}</p>

          <div className="target-row" role="group" aria-label="Pick a target chord">
            {TARGETS.map((name) => (
              <button
                key={name}
                className={`target-chip${name === target ? ' active' : ''}`}
                onClick={() => {
                  setTarget(name)
                  smooth.current = 0
                  hitUntil.current = 0
                  framesAbove.current = 0
                }}
              >
                {name}
              </button>
            ))}
          </div>

          <button className={`mic-btn${live ? ' live' : ''}`} onClick={toggle} style={{ marginTop: 18 }}>
            {live ? 'Stop listening' : 'Start listening'}
          </button>
        </div>

        <aside className={`corner-cameo${hit ? ' hit' : ''}`} aria-label="Chord shape you are playing">
          <p className="eyebrow">Your shape</p>
          <ChordDiagram shape={shape} accent={hit ? 'var(--moss)' : 'var(--petal)'} width={170} />
          <TabBlock shape={shape} />
        </aside>
      </div>
    </section>
  )
}
