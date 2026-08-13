import { useEffect, useMemo, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { detectPitch } from '../audio/pitch'
import { midiToFreq, midiToName, midiToNameWithOctave } from '../audio/notes'
import { TUNINGS } from '../data/tunings'

interface Reading {
  freq: number
  /** Cents from the current target (manual) or nearest string (auto). */
  cents: number
  targetMidi: number
}

const IN_TUNE_CENTS = 3
const STABLE_MS = 800

interface TunerProps {
  /** Feed the flower wall: level 0..1 (accuracy) and whether we're in tune. */
  onBloom?: (level: number, inTune: boolean) => void
}

export function TunerMode({ onBloom }: TunerProps) {
  const [live, setLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tuningId, setTuningId] = useState('standard')
  /** null = auto (nearest string); index = manually locked string. */
  const [lockedString, setLockedString] = useState<number | null>(null)
  const [reading, setReading] = useState<Reading | null>(null)
  const [tunedStrings, setTunedStrings] = useState<Set<number>>(new Set())
  const [a4, setA4] = useState(440)

  const rafRef = useRef(0)
  const smoothCents = useRef(0)
  const holdUntil = useRef(0)
  const stableSince = useRef<number | null>(null)
  const strobeRef = useRef<HTMLDivElement>(null)
  const strobePhase = useRef(0)
  const lastFrame = useRef(0)

  const tuning = TUNINGS.find((t) => t.id === tuningId)!
  const lockedRef = useRef(lockedString)
  lockedRef.current = lockedString
  const tuningRef = useRef(tuning)
  tuningRef.current = tuning
  const a4Ref = useRef(a4)
  a4Ref.current = a4
  const onBloomRef = useRef(onBloom)
  onBloomRef.current = onBloom
  const bloomLevel = useRef(0)

  useEffect(() => {
    if (!live) return
    const tick = (now: number) => {
      const dt = lastFrame.current ? Math.min(0.1, (now - lastFrame.current) / 1000) : 0.016
      lastFrame.current = now
      const frame = engine.mic.frame()
      if (frame) {
        const freq = detectPitch(frame, engine.ctx.sampleRate)
        if (freq) {
          const cal = a4Ref.current / 440
          const t = tuningRef.current
          let targetMidi: number
          if (lockedRef.current !== null) {
            targetMidi = t.midis[lockedRef.current]
          } else {
            // Auto: nearest string of the selected tuning.
            targetMidi = t.midis.reduce((best, m) =>
              Math.abs(freq - midiToFreq(m) * cal) < Math.abs(freq - midiToFreq(best) * cal) ? m : best,
            t.midis[0])
          }
          const targetFreq = midiToFreq(targetMidi) * cal
          const rawCents = 1200 * Math.log2(freq / targetFreq)
          const cents = Math.max(-99, Math.min(99, rawCents))
          smoothCents.current = smoothCents.current * 0.55 + cents * 0.45
          setReading({ freq, cents: smoothCents.current, targetMidi })
          holdUntil.current = now + 1200

          // Stability → mark the string as tuned.
          if (Math.abs(smoothCents.current) <= IN_TUNE_CENTS) {
            if (stableSince.current === null) stableSince.current = now
            else if (now - stableSince.current > STABLE_MS) {
              const idx = t.midis.indexOf(targetMidi)
              if (idx >= 0) {
                setTunedStrings((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)))
              }
            }
          } else {
            stableSince.current = null
          }
        } else if (now > holdUntil.current) {
          setReading(null)
          stableSince.current = null
        }
      }

      // Strobe ribbon: drift speed and direction follow the cents offset.
      const hasSignal = now < holdUntil.current
      if (strobeRef.current) {
        strobePhase.current += (hasSignal ? smoothCents.current : 0) * dt * 2.2
        strobeRef.current.style.backgroundPositionX = `${strobePhase.current}px`
        strobeRef.current.style.opacity = hasSignal ? '1' : '0.2'
      }

      // Flower wall: accuracy → bloom. 50¢ off = bare wall, 0¢ = full color.
      // Eased toward the target so the wall breathes instead of flickering.
      const targetBloom = hasSignal
        ? Math.max(0, 1 - Math.abs(smoothCents.current) / 50) ** 1.6
        : 0
      const rate = targetBloom > bloomLevel.current ? 4.5 : 1.2 // blooms fast, wilts slow
      bloomLevel.current += (targetBloom - bloomLevel.current) * Math.min(1, dt * rate)
      onBloomRef.current?.(
        bloomLevel.current,
        hasSignal && Math.abs(smoothCents.current) <= IN_TUNE_CENTS,
      )
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live])

  useEffect(
    () => () => {
      engine.mic.stop()
      onBloomRef.current?.(0, false)
    },
    [],
  )

  // Reset per-string progress when the tuning or calibration changes.
  useEffect(() => {
    setTunedStrings(new Set())
    setLockedString(null)
    stableSince.current = null
  }, [tuningId, a4])

  const toggle = async () => {
    if (live) {
      engine.mic.stop()
      setLive(false)
      setReading(null)
      bloomLevel.current = 0
      onBloomRef.current?.(0, false)
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

  const inTune = reading !== null && Math.abs(reading.cents) <= IN_TUNE_CENTS
  const clamped = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0
  const targetIdx = reading ? tuning.midis.indexOf(reading.targetMidi) : -1
  const allTuned = tunedStrings.size === tuning.midis.length

  const direction = useMemo(() => {
    if (!reading || inTune) return null
    return reading.cents < 0 ? 'tighten — tune up' : 'loosen — tune down'
  }, [reading, inTune])

  return (
    <section className="tuner-stage" aria-label="Tuner">
      {/* quiet settings, one text line */}
      <div className="tuner-top">
        <select
          className="tuner-tuning"
          value={tuningId}
          onChange={(e) => setTuningId(e.target.value)}
          aria-label="Choose a tuning"
        >
          {TUNINGS.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <label className="a4-label">
          A4
          <input
            type="number"
            className="a4-input"
            min={432}
            max={446}
            value={a4}
            onChange={(e) => setA4(Math.max(432, Math.min(446, Number(e.target.value) || 440)))}
            aria-label="Reference pitch A4 in hertz"
          />
        </label>
      </div>

      <p className="tuner-mode-line">
        {lockedString !== null ? (
          <>tuning <strong>{midiToNameWithOctave(tuning.midis[lockedString])}</strong> \u00b7 tap again for auto</>
        ) : live ? (
          'listening \u00b7 pluck any string'
        ) : (
          '\u00a0'
        )}
      </p>

      {/* the note is the interface */}
      <p className={`tuner-note${inTune ? ' in-tune' : ''}${reading ? '' : ' idle'}`}>
        {reading ? midiToName(reading.targetMidi) : '\u2014'}
        {reading && <span className="tuner-octave">{Math.floor(reading.targetMidi / 12) - 1}</span>}
      </p>

      <p className={`tuner-direction${inTune ? ' good' : ''}`}>
        {reading ? (inTune ? 'in tune' : direction) : '\u00a0'}
      </p>

      {/* one horizon line; the needle is a stem of light */}
      <div className="cents-scale" role="img" aria-label={reading ? `${Math.round(reading.cents)} cents from target` : 'No note detected'}>
        <div className="cents-line" />
        <div className="cents-center" />
        <div
          className={`cents-needle${inTune ? ' in-tune' : ''}`}
          style={{ left: `calc(50% + ${clamped * 0.9}%)`, opacity: reading ? 1 : 0 }}
        />
        <div
          ref={strobeRef}
          className={`strobe-ribbon${inTune ? ' in-tune' : ''}`}
          aria-hidden="true"
        />
      </div>

      <p className="tuner-freq">
        {reading
          ? `${reading.freq.toFixed(1)} Hz \u00b7 ${reading.cents > 0 ? '+' : ''}${Math.round(reading.cents)}\u00a2`
          : '\u00a0'}
      </p>

      {/* six strings, six words on the wall */}
      <div className="tuner-strings" role="group" aria-label="Strings, tap to lock one">
        {tuning.midis.map((midi, i) => {
          const isTarget = i === targetIdx
          const isLocked = lockedString === i
          const isDone = tunedStrings.has(i)
          return (
            <button
              key={`${tuningId}-${i}`}
              className={[
                'string-btn',
                isTarget ? 'near' : '',
                isLocked ? 'locked' : '',
                isDone ? 'done' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setLockedString(isLocked ? null : i)}
              aria-pressed={isLocked}
              aria-label={`String ${i + 1}: ${midiToNameWithOctave(midi)}${isDone ? ', tuned' : ''}`}
            >
              {midiToNameWithOctave(midi)}
              <span className="string-mark">{isDone ? '\u25cf' : '\u25cb'}</span>
            </button>
          )
        })}
      </div>

      {allTuned && <p className="tuner-alltuned">all six in bloom \u2014 go make some noise</p>}

      <button className={`mic-btn tuner-mic-btn${live ? ' live' : ''}`} onClick={toggle}>
        <span className="mic-btn-label">{live ? 'stop' : 'start tuner'}</span>
        {!live && <span className="mic-btn-invite" aria-hidden="true">tap to wake the garden</span>}
      </button>
      {error && <p className="listen-status">{error}</p>}
    </section>
  )
}
