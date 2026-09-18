import type { ChordSegment, SongFrame } from './songAnalysisTypes'

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

const NO_CHORD = TRIAD_TEMPLATES.length
const STATES = NO_CHORD + 1
const MIN_SEGMENT_SECONDS = 0.3
/** Score a chord change must earn back before it is worth switching. */
const CHANGE_PENALTY = 0.6
/** Similarity an audible frame must beat with some triad to count as a chord at all. */
const NO_CHORD_SIMILARITY = 0.55
/**
 * A frame with one predominant pitch is a melody note, not a chord: "N"
 * then beats the best triad by this margin. A lone melody (every frame has
 * a pitch) reads as no chord, while a sung note over a held chord lasts a
 * few frames and costs less than two chord changes, so the chord holds.
 */
const MONO_MARGIN = 0.05
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

interface RawSegment {
  state: number
  startFrame: number
  endFrame: number
}

/**
 * Best state sequence where every segment lasts at least `minFrames` and each
 * change costs CHANGE_PENALTY. Entering a state commits to its first
 * `minFrames` frames at once, so the ring buffer only needs that many rows.
 */
function viterbi(
  emissions: Float32Array,
  frameCount: number,
  minFrames: number,
): RawSegment[] {
  const rows = minFrames + 1
  const scores = new Float64Array(rows * STATES).fill(Number.NEGATIVE_INFINITY)
  const window = new Float64Array(STATES)
  const bestAt = new Float64Array(frameCount)
  const argAt = new Uint8Array(frameCount)
  const entered = new Uint8Array(frameCount * STATES)

  for (let frame = 0; frame < frameCount; frame++) {
    const row = (frame % rows) * STATES
    const previousRow = ((frame + rows - 1) % rows) * STATES
    const enterBase =
      frame >= minFrames
        ? bestAt[frame - minFrames] - CHANGE_PENALTY
        : frame === minFrames - 1
          ? 0
          : Number.NEGATIVE_INFINITY
    let best = Number.NEGATIVE_INFINITY
    let arg = 0
    for (let state = 0; state < STATES; state++) {
      const emission = emissions[frame * STATES + state]
      window[state] += emission
      if (frame >= minFrames)
        window[state] -= emissions[(frame - minFrames) * STATES + state]
      const stay =
        frame > 0
          ? scores[previousRow + state] + emission
          : Number.NEGATIVE_INFINITY
      const enter = enterBase + window[state]
      let score = stay
      if (enter > stay) {
        score = enter
        entered[frame * STATES + state] = 1
      }
      scores[row + state] = score
      if (score > best) {
        best = score
        arg = state
      }
    }
    bestAt[frame] = best
    argAt[frame] = arg
  }

  const segments: RawSegment[] = []
  let frame = frameCount - 1
  let state = argAt[frame]
  let endFrame = frameCount
  while (frame >= 0) {
    if (entered[frame * STATES + state]) {
      const startFrame = frame - minFrames + 1
      segments.push({ state, startFrame, endFrame })
      frame = startFrame - 1
      if (frame < 0) break
      state = argAt[frame]
      endFrame = startFrame
    } else {
      frame--
    }
  }
  segments.reverse()
  return segments
}

/**
 * Label the chords of a recording from chroma alone. The Viterbi pass over the
 * 24 triads plus "N" charges a penalty per change and commits to at least
 * MIN_SEGMENT_SECONDS per segment, so vocals or a bass note cannot flip the
 * label for a frame or two. Frames where one pitch dominates count as a
 * melody note, so a solo line reads as "N" rather than a string of chords.
 * Slash chords and sevenths resolve to the nearest triad. Confidence is the
 * mean template similarity along the segment.
 */
export function recognizeChords(
  frames: readonly SongFrame[],
  hopSeconds: number,
  duration: number,
): ChordSegment[] {
  const frameCount = frames.length
  if (frameCount === 0) return []
  const { unit, audible } = unitChroma(frames, audibleFloor(frames))

  const emissions = new Float32Array(frameCount * STATES)
  for (let index = 0; index < frameCount; index++) {
    const base = index * STATES
    if (!audible[index]) {
      for (let state = 0; state < NO_CHORD; state++)
        emissions[base + state] = -SIMILARITY_CENTER
      continue
    }
    let best = 0
    for (let state = 0; state < NO_CHORD; state++) {
      const similarity = chromaSimilarity(
        unit,
        index,
        TRIAD_TEMPLATES[state].pitchClasses,
      )
      emissions[base + state] = similarity - SIMILARITY_CENTER
      best = Math.max(best, similarity)
    }
    const noChord =
      frames[index].midi === null
        ? NO_CHORD_SIMILARITY
        : Math.max(NO_CHORD_SIMILARITY, best + MONO_MARGIN)
    emissions[base + NO_CHORD] = noChord - SIMILARITY_CENTER
  }

  const hop = Number.isFinite(hopSeconds) && hopSeconds > 0 ? hopSeconds : 0.05
  const minFrames = Math.max(
    1,
    Math.min(frameCount, Math.round(MIN_SEGMENT_SECONDS / hop)),
  )

  // Same-state neighbours only arise from ties; merge them before labelling.
  const merged: RawSegment[] = []
  for (const segment of viterbi(emissions, frameCount, minFrames)) {
    const previous = merged.at(-1)
    if (previous && previous.state === segment.state)
      previous.endFrame = segment.endFrame
    else merged.push({ ...segment })
  }

  return merged.map(({ state, startFrame, endFrame }, index) => {
    let similarity = 0
    if (state !== NO_CHORD) {
      for (let frame = startFrame; frame < endFrame; frame++)
        similarity += emissions[frame * STATES + state] + SIMILARITY_CENTER
      similarity /= endFrame - startFrame
    }
    return {
      label: state === NO_CHORD ? 'N' : TRIAD_TEMPLATES[state].label,
      start: index === 0 ? 0 : frames[startFrame].time,
      end: endFrame < frameCount ? frames[endFrame].time : duration,
      confidence: Math.max(0, Math.min(1, similarity)),
    }
  })
}
