import { useEffect, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { detectPitch } from '../audio/pitch'
import { readPitch, OPEN_STRINGS, STRING_LABELS, midiToNameWithOctave } from '../audio/notes'

interface Display {
  name: string
  freq: number
  cents: number
  midi: number
}

export function TunerMode() {
  const [live, setLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [display, setDisplay] = useState<Display | null>(null)
  const rafRef = useRef(0)
  const smoothCents = useRef(0)
  const holdUntil = useRef(0)

  useEffect(() => {
    if (!live) return
    const tick = () => {
      const frame = engine.mic.frame()
      if (frame) {
        const freq = detectPitch(frame, engine.ctx.sampleRate)
        if (freq) {
          const r = readPitch(freq)
          // Light smoothing keeps the needle steady without feeling laggy.
          smoothCents.current = smoothCents.current * 0.6 + r.cents * 0.4
          setDisplay({ name: r.nameWithOctave, freq: r.freq, cents: smoothCents.current, midi: r.midi })
          holdUntil.current = performance.now() + 1500
        } else if (performance.now() > holdUntil.current) {
          setDisplay(null)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [live])

  useEffect(() => () => engine.mic.stop(), [])

  const toggle = async () => {
    if (live) {
      engine.mic.stop()
      setLive(false)
      setDisplay(null)
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

  const inTune = display !== null && Math.abs(display.cents) <= 5
  const clamped = display ? Math.max(-50, Math.min(50, display.cents)) : 0

  return (
    <section className="panel" aria-label="Tuner">
      <p className="eyebrow">Tuner · standard EADGBe</p>

      <div className="tuner-face">
        <p className={`tuner-note${inTune ? ' in-tune' : ''}`} style={display ? undefined : { opacity: 0.25 }}>
          {display ? display.name : '·'}
        </p>
        <p className="tuner-freq">
          {display
            ? `${display.freq.toFixed(1)} Hz · ${display.cents > 0 ? '+' : ''}${Math.round(display.cents)} cents`
            : live
              ? 'Pluck one string…'
              : 'Mic is off'}
        </p>

        <div className="cents-scale" role="img" aria-label={display ? `${Math.round(display.cents)} cents from ${display.name}` : 'No note detected'}>
          <div className="cents-line" />
          <div className="cents-center" />
          <div
            className={`cents-needle${inTune ? ' in-tune' : ''}`}
            style={{ transform: `translateX(calc(${(clamped / 50) * 200}px - 50%))`, opacity: display ? 1 : 0.25 }}
          />
          <div className="cents-labels">
            <span>♭ 50</span>
            <span>0</span>
            <span>50 ♯</span>
          </div>
        </div>

        <div className="tuner-strings">
          {OPEN_STRINGS.map((midi, i) => (
            <span key={midi} className={`string-chip${display && display.midi === midi ? ' near' : ''}`}>
              {STRING_LABELS[i]} · {midiToNameWithOctave(midi)}
            </span>
          ))}
        </div>

        <button className={`mic-btn${live ? ' live' : ''}`} onClick={toggle}>
          {live ? 'Stop tuner' : 'Start tuner'}
        </button>
        {error && <p className="listen-status">{error}</p>}
      </div>
    </section>
  )
}
