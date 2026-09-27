import { useEffect, useRef } from 'react'
import type { TimedChord } from '../data/songSync'
import type { VideoClock } from './useYouTubeClock'

interface Props {
  /** Chord changes with repeats merged (see chordRuns), in seconds or steps. */
  runs: readonly TimedChord[]
  /** Section starts, in the same unit as `runs`. */
  sections: readonly { label: string; start: number }[]
  /** Where the song is now, in the same unit. */
  at: number
  /** Seconds follow the clock every frame; steps slide one chord at a time. */
  unit: 'seconds' | 'steps'
  clock: VideoClock
}

/**
 * The chords still to come, sliding toward the playhead at the left edge.
 * Each block is as wide as the chord rings, so the lit block shrinking into
 * the playhead is the countdown to the next change. Purely visual: the sheet
 * and the chord timeline are the ways to seek.
 */
export function ChordRunway({ runs, sections, at, unit, clock }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const animate = unit === 'seconds' && clock.playing
  const current = runs.findIndex((run) => run.start <= at && at < run.end)

  // CSS places everything from --at; while the song plays it is written every
  // frame from the clock so the blocks glide instead of ticking at 10 Hz.
  useEffect(() => {
    if (!animate) track.current?.style.setProperty('--at', String(at))
  }, [animate, at])
  useEffect(() => {
    if (!animate) return
    let frame = 0
    const tick = () => {
      const time = clock.time()
      if (time !== null) track.current?.style.setProperty('--at', String(time))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animate, clock])

  return (
    <div className={`runway by-${unit}`} aria-hidden="true">
      <div className="runway-track" ref={track}>
        {sections.map((section) => (
          <span
            key={section.start}
            className="runway-section"
            style={{ '--start': section.start }}
          >
            {section.label}
          </span>
        ))}
        {runs.map((run, i) => (
          <span
            key={run.start}
            className={`runway-chord${i === current ? ' now' : ''}`}
            style={{ '--start': run.start, '--len': run.end - run.start }}
          >
            {run.label}
          </span>
        ))}
      </div>
    </div>
  )
}
