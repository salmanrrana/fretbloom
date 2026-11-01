import type { SongFrame } from './songAnalysisTypes'

export const PITCH_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

/** The 24 major/minor triads, ordered C, Cm, C#, C#m, ... */
export const TRIAD_TEMPLATES: readonly {
  label: string
  pitchClasses: readonly number[]
}[] = PITCH_NAMES.flatMap((name, root) => [
  { label: name, pitchClasses: [root, (root + 4) % 12, (root + 7) % 12] },
  {
    label: `${name}m`,
    pitchClasses: [root, (root + 3) % 12, (root + 7) % 12],
  },
])

/** Flat chroma scores 0.5 against any triad; emissions are centered there. */
export const SIMILARITY_CENTER = 0.5

/** Quiet frames are ignored: below 2% of the loudest frame, or nearly digital silence. */
export function audibleFloor(frames: readonly SongFrame[]): number {
  let peak = 0
  for (const frame of frames) {
    if (Number.isFinite(frame.rms)) peak = Math.max(peak, frame.rms)
  }
  return Math.max(0.0015, peak * 0.02)
}

export interface UnitChroma {
  /** 12 values per frame, scaled to unit length; all zero when inaudible. */
  unit: Float32Array
  audible: Uint8Array
}

/** Prepare chroma once so a pitch-class set scores with a handful of adds. */
export function unitChroma(
  frames: readonly SongFrame[],
  floor: number,
): UnitChroma {
  const unit = new Float32Array(frames.length * 12)
  const audible = new Uint8Array(frames.length)
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index]
    if (!Number.isFinite(frame.rms) || frame.rms < floor) continue
    let energy = 0
    for (let pc = 0; pc < 12; pc++) {
      const value = frame.chroma[pc]
      if (Number.isFinite(value) && value > 0) energy += value * value
    }
    if (energy === 0) continue
    const scale = 1 / Math.sqrt(energy)
    for (let pc = 0; pc < 12; pc++) {
      const value = frame.chroma[pc]
      unit[index * 12 + pc] =
        Number.isFinite(value) && value > 0 ? value * scale : 0
    }
    audible[index] = 1
  }
  return { unit, audible }
}

/**
 * Cosine similarity between frame `index` and a pitch-class set, 0..1. A
 * perfect triad scores 1, flat chroma 0.5, silence 0.
 */
export function chromaSimilarity(
  unit: Float32Array,
  index: number,
  pitchClasses: readonly number[],
): number {
  if (pitchClasses.length === 0) return 0
  let dot = 0
  for (const pc of pitchClasses) dot += unit[index * 12 + pc]
  return dot / Math.sqrt(pitchClasses.length)
}
