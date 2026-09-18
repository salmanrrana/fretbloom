import {
  audibleFloor,
  chromaSimilarity,
  SIMILARITY_CENTER,
  TRIAD_TEMPLATES,
  unitChroma,
} from './chordRecognition'

import type {
  AlignmentResult,
  SongAnalysis,
  SongFrame,
  SyncTarget,
} from './songAnalysisTypes'

// The frame-by-run traceback is the only large allocation. Capping it keeps a
// long recording with a large pasted tab from locking up the browser.
const MAX_DP_CELLS = 4_000_000
const MAX_WORKING_FRAMES = 20_000
const MAX_TARGETS = 600
const MIN_PEAK_RMS = 0.003
const MIN_CHORD_SECONDS = 0.25
const MIN_NOTE_SECONDS = 0.07
/** Frames scanned when ranking transpositions; a subsample is plenty. */
const TRANSPOSE_SCAN_FRAMES = 2_000
/** Another key must explain this much more per audible frame to beat 0. */
const TRANSPOSE_MARGIN = 0.01
/**
 * Quiet frames cost a little inside a run so runs hug the audible span. The
 * intro and outro are free, so a run never stretches into leading silence.
 */
const SILENT_FRAME_SCORE = -0.02
/**
 * Extra cost per frame when some other triad explains the frame better than
 * the run's chord. Without it a run would happily bridge a short different
 * chord that the paste omits; with it, anything a chord's length long counts.
 */
const REGRET_WEIGHT = 1
/**
 * A stretch of a chord run is "foreign" when a triad outside the run's chord
 * beats it by this margin for this long. Inside the sheet that is a chord
 * the paste omits; in the last run it is the recording carrying on after
 * the sheet ends. Shorter or fainter stretches are passing tones and held
 * vocal notes (the CCR recording peaks at 0.7 s over the 0.1 margin).
 */
const FOREIGN_MARGIN = 0.1
const FOREIGN_SECONDS = 1.25
/** A run scoring below flat chroma (0.5) was not really heard. */
const WEAK_RUN_MIN = 0.5
/** One weak step per this many pasted steps is tolerated and named, not refused. */
const WEAK_STEPS_PER = 20
const OVERALL_MIN = 0.62
const EXPLAINED_MIN = 0.7

const TRACE_STAY = 0
const TRACE_ENTER = 1

/** One distinct sound in the paste: a pitch-class set for chords, exact MIDI for notes. */
interface SoundKey {
  kind: SyncTarget['kind']
  midis: number[]
  pitchClasses: number[]
  /** Single tab notes are compared octave-sensitively via the detected MIDI. */
  mono: boolean
}

/** Consecutive targets that sound the same. Their boundary is inaudible. */
interface Run {
  key: number
  firstTarget: number
  members: number
}

interface Path {
  starts: Int32Array
  endFrame: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12
}

function positive(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0
}

function timestamp(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** "Chord 30 (D)" or "Note 4", the way the reasons name a pasted step. */
function describeTarget(target: SyncTarget, index: number): string {
  const noun = target.kind === 'notes' ? 'Note' : 'Chord'
  return `${noun} ${index + 1}${target.label ? ` (${target.label})` : ''}`
}

/** Collapse targets into distinct keys and same-key runs. */
function prepareRuns(targets: readonly SyncTarget[]): {
  keys: SoundKey[]
  runs: Run[]
} {
  const keys: SoundKey[] = []
  const keyIndex = new Map<string, number>()
  const runs: Run[] = []
  targets.forEach((target, targetIndex) => {
    const midis = target.midis.filter(Number.isFinite).map(Math.round)
    const pitchClasses = [...new Set(midis.map(pitchClass))].sort(
      (left, right) => left - right,
    )
    const mono = target.kind === 'notes' && midis.length === 1
    const id = mono
      ? `mono:${midis[0]}`
      : `${target.kind}:${pitchClasses.join(',')}`
    let key = keyIndex.get(id)
    if (key === undefined) {
      key = keys.length
      keyIndex.set(id, key)
      keys.push({ kind: target.kind, midis, pitchClasses, mono })
    }
    const previous = runs.at(-1)
    if (previous && previous.key === key) previous.members++
    else runs.push({ key, firstTarget: targetIndex, members: 1 })
  })
  return { keys, runs }
}

function sortedFrames(frames: readonly SongFrame[]): SongFrame[] {
  return frames
    .filter((frame) => Number.isFinite(frame.time) && frame.time >= 0)
    .slice()
    .sort((left, right) => left.time - right.time)
}

/** Combine adjacent frames when needed instead of allocating an unbounded DP matrix. */
function reduceFrames(
  frames: readonly SongFrame[],
  runCount: number,
): SongFrame[] {
  const maximumFrames = Math.max(
    runCount,
    Math.min(MAX_WORKING_FRAMES, Math.floor(MAX_DP_CELLS / runCount)),
  )
  if (frames.length <= maximumFrames) return frames.slice()

  const stride = Math.ceil(frames.length / maximumFrames)
  const reduced: SongFrame[] = []
  for (let start = 0; start < frames.length; start += stride) {
    const end = Math.min(frames.length, start + stride)
    const chroma = Array.from({ length: 12 }, () => 0)
    const midiWeights = new Map<number, number>()
    let rms = 0

    for (let index = start; index < end; index++) {
      const frame = frames[index]
      rms += Math.max(0, frame.rms)
      for (let pc = 0; pc < 12; pc++) chroma[pc] += positive(frame.chroma[pc])
      if (frame.midi !== null && Number.isFinite(frame.midi)) {
        const midi = Math.round(frame.midi)
        midiWeights.set(
          midi,
          (midiWeights.get(midi) ?? 0) + Math.max(frame.rms, 0.001),
        )
      }
    }

    const count = end - start
    for (let pc = 0; pc < 12; pc++) chroma[pc] /= count
    let midi: number | null = null
    let midiWeight = 0
    for (const [candidate, weight] of midiWeights) {
      if (weight > midiWeight) {
        midi = candidate
        midiWeight = weight
      }
    }
    reduced.push({ time: frames[start].time, chroma, midi, rms: rms / count })
  }
  return reduced
}

/**
 * How well frame `index` matches a key transposed by `transpose` semitones
 * (-5..6), 0..1. Chords use chroma only. Single notes lean on the
 * octave-sensitive detected MIDI; simultaneous tab notes lean on chroma
 * because the pitch detector rightly refuses to pick one note from a cluster.
 */
function keyScore(
  frame: SongFrame,
  unit: Float32Array,
  index: number,
  key: SoundKey,
  pitchClasses: readonly number[],
  transpose: number,
): number {
  const spectral = chromaSimilarity(unit, index, pitchClasses)
  if (key.kind === 'chord') return spectral

  let pitch = 0
  if (frame.midi !== null && Number.isFinite(frame.midi)) {
    let distance = Number.POSITIVE_INFINITY
    for (const midi of key.midis)
      distance = Math.min(distance, Math.abs(frame.midi - midi - transpose))
    if (distance <= 0.6) pitch = 1
    else if (distance <= 1.25) pitch = 0.45
  }
  return key.mono
    ? 0.72 * pitch + 0.28 * spectral
    : 0.25 * pitch + 0.75 * spectral
}

/** Centered emissions for every frame and key at one transposition, frame-major. */
function emissions(
  frames: readonly SongFrame[],
  unit: Float32Array,
  audible: Uint8Array,
  keys: readonly SoundKey[],
  shifted: readonly number[][],
  transpose: number,
): Float32Array {
  const keyCount = keys.length
  const out = new Float32Array(frames.length * keyCount)
  for (let index = 0; index < frames.length; index++) {
    const base = index * keyCount
    if (!audible[index]) {
      out.fill(SILENT_FRAME_SCORE, base, base + keyCount)
      continue
    }
    for (let key = 0; key < keyCount; key++) {
      out[base + key] =
        keyScore(
          frames[index],
          unit,
          index,
          keys[key],
          shifted[key],
          transpose,
        ) - SIMILARITY_CENTER
    }
  }
  return out
}

function shiftedPitchClasses(
  keys: readonly SoundKey[],
  transpose: number,
): number[][] {
  return keys.map((key) =>
    key.pitchClasses.map((pc) => pitchClass(pc + transpose)),
  )
}

/**
 * Rank the 12 transpositions by how well the paste's sounds explain the
 * audio ignoring order (the best key per frame, summed over a subsample) and
 * return the winner as signed semitones in -5..6. Order-free scoring is
 * cheap; alignSong verifies the winner with the ordered pass and falls back
 * to 0 when that fails.
 */
function chooseTranspose(
  frames: readonly SongFrame[],
  unit: Float32Array,
  audible: Uint8Array,
  keys: readonly SoundKey[],
): number {
  const stride = Math.max(1, Math.ceil(frames.length / TRANSPOSE_SCAN_FRAMES))
  const scores = new Float64Array(12)
  let scanned = 0
  for (let shift = 0; shift < 12; shift++) {
    const transpose = shift > 6 ? shift - 12 : shift
    const shifted = shiftedPitchClasses(keys, transpose)
    for (let index = 0; index < frames.length; index += stride) {
      if (!audible[index]) continue
      if (shift === 0) scanned++
      let best = 0
      for (let key = 0; key < keys.length; key++) {
        best = Math.max(
          best,
          keyScore(
            frames[index],
            unit,
            index,
            keys[key],
            shifted[key],
            transpose,
          ),
        )
      }
      scores[shift] += best
    }
  }
  let chosen = 0
  for (let shift = 1; shift < 12; shift++) {
    if (scores[shift] > scores[chosen]) chosen = shift
  }
  if (scores[chosen] - scores[0] <= TRANSPOSE_MARGIN * scanned) return 0
  return chosen > 6 ? chosen - 12 : chosen
}

/** Centered similarity minus the regret against the best free triad. */
function regretAdjusted(
  scored: Float32Array,
  freeBest: Float32Array,
  keyCount: number,
  frame: number,
  key: number,
): number {
  const emission = scored[frame * keyCount + key]
  return emission - REGRET_WEIGHT * Math.max(0, freeBest[frame] - emission)
}

/** Best centered triad similarity per frame: what free recognition would score. */
function freeBestPerFrame(
  unit: Float32Array,
  audible: Uint8Array,
  frameCount: number,
): Float32Array {
  const out = new Float32Array(frameCount)
  for (let frame = 0; frame < frameCount; frame++) {
    if (!audible[frame]) continue
    let best = 0
    for (const triad of TRIAD_TEMPLATES)
      best = Math.max(best, chromaSimilarity(unit, frame, triad.pitchClasses))
    out[frame] = best - SIMILARITY_CENTER
  }
  return out
}

/** The triad that best explains frames [from, to), by name. */
function loudestTriad(unit: Float32Array, from: number, to: number): string {
  let best = ''
  let bestSum = Number.NEGATIVE_INFINITY
  for (const triad of TRIAD_TEMPLATES) {
    let sum = 0
    for (let frame = from; frame < to; frame++)
      sum += chromaSimilarity(unit, frame, triad.pitchClasses)
    if (sum > bestSum) {
      bestSum = sum
      best = triad.label
    }
  }
  return best
}

/**
 * Forced alignment: every run in order, each lasting at least its minimum,
 * with a free intro before the first run and a free outro after the last.
 * Entering a run commits to its minimum frames at once, so scores only need
 * a ring buffer that deep.
 */
function findPath(
  scored: Float32Array,
  freeBest: Float32Array,
  keyCount: number,
  frameCount: number,
  runs: readonly Run[],
  minFrames: Int32Array,
): Path | null {
  const runCount = runs.length
  const deepest = Math.max(...minFrames)
  const rows = deepest + 1
  const scores = new Float64Array(rows * runCount).fill(
    Number.NEGATIVE_INFINITY,
  )
  const window = new Float64Array(runCount)
  const trace = new Uint8Array(frameCount * runCount)
  let bestEnd = Number.NEGATIVE_INFINITY
  let endFrame = -1

  for (let frame = 0; frame < frameCount; frame++) {
    const row = (frame % rows) * runCount
    const previousRow = ((frame + rows - 1) % rows) * runCount
    for (let run = 0; run < runCount; run++) {
      const key = runs[run].key
      const depth = minFrames[run]
      const emission = regretAdjusted(scored, freeBest, keyCount, frame, key)
      window[run] += emission
      if (frame >= depth)
        window[run] -= regretAdjusted(
          scored,
          freeBest,
          keyCount,
          frame - depth,
          key,
        )

      const stay =
        frame > 0
          ? scores[previousRow + run] + emission
          : Number.NEGATIVE_INFINITY
      let enter = Number.NEGATIVE_INFINITY
      if (frame >= depth - 1) {
        const prior =
          run === 0
            ? 0
            : frame >= depth
              ? scores[((frame - depth) % rows) * runCount + run - 1]
              : Number.NEGATIVE_INFINITY
        enter = prior + window[run]
      }
      // Ties go to entering later, so a rest stays with the target before it.
      if (enter >= stay) {
        scores[row + run] = enter
        trace[frame * runCount + run] = TRACE_ENTER
      } else {
        scores[row + run] = stay
        trace[frame * runCount + run] = TRACE_STAY
      }
    }
    const last = scores[row + runCount - 1]
    if (last > bestEnd) {
      bestEnd = last
      endFrame = frame
    }
  }
  if (endFrame < 0 || !Number.isFinite(bestEnd)) return null

  const starts = new Int32Array(runCount)
  let frame = endFrame
  for (let run = runCount - 1; run >= 0;) {
    if (trace[frame * runCount + run] === TRACE_ENTER) {
      starts[run] = frame - minFrames[run] + 1
      frame = starts[run] - 1
      run--
    } else {
      frame--
    }
    if (frame < 0 && run >= 0) return null
  }
  return { starts, endFrame }
}

function result(
  times: number[],
  confidence: number,
  reliable: boolean,
  reason: string,
  transpose = 0,
): AlignmentResult {
  return { times, confidence: clamp01(confidence), reliable, reason, transpose }
}

/**
 * Place every pasted target on the recording's timeline. Adjacent targets
 * that sound identical are aligned as one run and then split evenly, since
 * their boundary is not audible. All 12 transpositions of the paste are
 * considered so a capo or a different key still follows the video. The
 * result is reliable only when the pasted order explains the audio nearly
 * as well as unconstrained chord recognition does; a sheet that covers only
 * part of the song is placed on that part, and a few chords that were not
 * heard clearly are named rather than refused.
 */
export function alignSong(
  analysis: SongAnalysis,
  targets: readonly SyncTarget[],
): AlignmentResult {
  if (targets.length === 0) {
    return result(
      [],
      0,
      false,
      'Paste at least one chord or note before syncing.',
    )
  }

  const frames = sortedFrames(analysis.frames)
  if (frames.length === 0) {
    return result(
      [],
      0,
      false,
      'No audio frames were available. Analyze the recording again.',
    )
  }
  if (targets.length > MAX_TARGETS) {
    return result(
      [],
      0,
      false,
      `This paste has ${targets.length} targets. Sync a section of ${MAX_TARGETS} or fewer at a time.`,
    )
  }

  let peakRms = 0
  for (const frame of frames) {
    if (Number.isFinite(frame.rms)) peakRms = Math.max(peakRms, frame.rms)
  }
  if (peakRms < MIN_PEAK_RMS) {
    return result(
      [],
      0,
      false,
      'The recording is too quiet to hear pitched notes. Use a clearer or louder recording.',
    )
  }

  const { keys, runs } = prepareRuns(targets)
  const working = reduceFrames(frames, runs.length)
  const reportedHop =
    Number.isFinite(analysis.hopSeconds) && analysis.hopSeconds > 0
      ? analysis.hopSeconds
      : 0
  const observedHop =
    frames.length > 1
      ? (frames.at(-1)!.time - frames[0].time) / (frames.length - 1)
      : 0
  const sourceHop = reportedHop || (observedHop > 0 ? observedHop : 0.05)
  const hop = Math.max(0.01, sourceHop * (frames.length / working.length))
  const duration =
    Number.isFinite(analysis.duration) && analysis.duration > 0
      ? analysis.duration
      : working.at(-1)!.time + hop
  const minFrames = Int32Array.from(runs, (run) => {
    const seconds =
      keys[run.key].kind === 'chord' ? MIN_CHORD_SECONDS : MIN_NOTE_SECONDS
    return run.members * Math.max(1, Math.ceil(seconds / hop - 1e-9))
  })
  const requiredFrames = minFrames.reduce((sum, count) => sum + count, 0)
  if (working.length < requiredFrames) {
    return result(
      [],
      0,
      false,
      'The recording is too short to place every target. Use a longer recording or a shorter paste.',
    )
  }

  const { unit, audible } = unitChroma(working, audibleFloor(working))
  const freeBest = freeBestPerFrame(unit, audible, working.length)
  const keyCount = keys.length
  const last = runs.length - 1
  const foreignFrames = Math.max(1, Math.ceil(FOREIGN_SECONDS / hop - 1e-9))
  const weakAllowance = Math.max(1, Math.floor(targets.length / WEAK_STEPS_PER))

  const alignAt = (transpose: number): AlignmentResult => {
    const shifted = shiftedPitchClasses(keys, transpose)
    const scored = emissions(working, unit, audible, keys, shifted, transpose)
    const path = findPath(
      scored,
      freeBest,
      keyCount,
      working.length,
      runs,
      minFrames,
    )
    if (!path) {
      return result(
        [],
        0,
        false,
        'The recording does not contain enough ordered evidence to place every target.',
        transpose,
      )
    }

    // What unconstrained recognition scores per frame: the best triad or any
    // of the sheet's own sounds, whichever is higher.
    const free = new Float32Array(working.length)
    for (let frame = 0; frame < working.length; frame++) {
      if (!audible[frame]) continue
      let best = freeBest[frame]
      for (let key = 0; key < keyCount; key++)
        best = Math.max(best, scored[frame * keyCount + key])
      free[frame] = best
    }

    // Triads that are not part of a chord key: what "another chord" means
    // for it. C7 or C/B over plain C audio is a spelling, not a missing chord.
    const outsideTriads = shifted.map((pitchClasses, key) =>
      keys[key].kind !== 'chord'
        ? []
        : TRIAD_TEMPLATES.filter((triad) =>
            triad.pitchClasses.some((pc) => !pitchClasses.includes(pc)),
          ),
    )
    // First frame in [from, to) opening FOREIGN_SECONDS of consecutive audible
    // frames where an outside triad beats the run's chord by the margin, or -1.
    const foreignStretch = (key: number, from: number, to: number): number => {
      const triads = outsideTriads[key]
      if (triads.length === 0) return -1
      let count = 0
      for (let frame = from; frame < to; frame++) {
        if (!audible[frame]) {
          count = 0
          continue
        }
        let best = 0
        for (const triad of triads)
          best = Math.max(
            best,
            chromaSimilarity(unit, frame, triad.pitchClasses),
          )
        count =
          best - SIMILARITY_CENTER - scored[frame * keyCount + key] >
          FOREIGN_MARGIN
            ? count + 1
            : 0
        if (count >= foreignFrames) return frame - foreignFrames + 1
      }
      return -1
    }

    // Exclusive end frame per run. An interior run that bridges a foreign
    // stretch means the sheet omits a chord; the last run simply stops where
    // the recording moves on, so a partial sheet gets its real span.
    const ends = Int32Array.from(runs, (_, run) =>
      run < last ? path.starts[run + 1] : path.endFrame + 1,
    )
    let missing: { run: number; at: number } | null = null
    for (let run = 0; run <= last && !missing; run++) {
      const at = foreignStretch(runs[run].key, path.starts[run], ends[run])
      if (at < 0) continue
      if (run < last) missing = { run, at }
      else ends[last] = Math.max(at, path.starts[last] + minFrames[last])
    }
    const trimmed = ends[last] <= path.endFrame
    const lastEnd = trimmed
      ? working[ends[last]].time
      : path.endFrame + 1 < working.length
        ? working[path.endFrame + 1].time
        : Math.max(duration, working[path.endFrame].time)

    // Spread each run evenly over its members; the boundary is unobservable.
    const times: number[] = []
    runs.forEach((run, index) => {
      const start = working[path.starts[index]].time
      const end = index < last ? working[ends[index]].time : lastEnd
      const span = Math.max(0, end - start)
      for (let member = 0; member < run.members; member++)
        times.push(start + (span * member) / run.members)
    })

    // Evidence: mean similarity per run, overall, and versus free recognition.
    let pathSum = 0
    let freeSum = 0
    let audibleCount = 0
    const heard = new Int32Array(runs.length)
    const means = runs.map((run, index) => {
      let sum = 0
      for (let frame = path.starts[index]; frame < ends[index]; frame++) {
        if (!audible[frame]) continue
        sum += scored[frame * keyCount + run.key]
        freeSum += free[frame]
        heard[index]++
      }
      pathSum += sum
      audibleCount += heard[index]
      return heard[index] > 0 ? sum / heard[index] + SIMILARITY_CENTER : 0
    })
    const overall =
      audibleCount > 0 ? pathSum / audibleCount + SIMILARITY_CENTER : 0
    const explained = freeSum > 0 ? pathSum / freeSum : 0
    const weakest = Math.min(...means)
    const confidence = 0.6 * overall + 0.4 * weakest
    // Weak: below flat chroma, or held at its minimum length while scoring
    // below the sheet's own average: the path kept it as short as it could.
    // A wrong sheet in the right key shows up as many such runs.
    const weak = means.flatMap((mean, run) =>
      mean < WEAK_RUN_MIN ||
      (mean < overall && ends[run] - path.starts[run] <= minFrames[run])
        ? [run]
        : [],
    )
    // Runs at the end with no audible frames were parked after the music.
    let unheardTail = runs.length
    while (unheardTail > 0 && heard[unheardTail - 1] === 0) unheardTail--
    const describe = (run: number): string =>
      describeTarget(targets[runs[run].firstTarget], runs[run].firstTarget)

    if (missing) {
      const heardAs = loudestTriad(unit, missing.at, missing.at + foreignFrames)
      return result(
        times,
        confidence,
        false,
        `At ${timestamp(working[missing.at].time)} the recording sounds like ${heardAs} while the sheet is still on ${describe(missing.run)}. Check the sheet for a missing chord there.`,
        transpose,
      )
    }
    const weakSteps = weak.reduce((sum, run) => sum + runs[run].members, 0)
    if (weakSteps > weakAllowance) {
      let weakestRun = 0
      for (const run of weak)
        if (means[run] < means[weakestRun]) weakestRun = run
      return result(
        times,
        confidence,
        false,
        unheardTail < runs.length
          ? `${describe(unheardTail)} and the rest of the sheet fall after the music ends. The sheet has more chords than the recording plays.`
          : `${describe(weakestRun)} and ${weakSteps - runs[weakestRun].members} more were not heard clearly enough. Check that the chords and their order match this version of the song.`,
        transpose,
      )
    }
    if (overall < OVERALL_MIN || explained < EXPLAINED_MIN) {
      return result(
        times,
        confidence,
        false,
        'The recording only weakly matches the pasted sequence. Check that the chords and their order match this version of the song.',
        transpose,
      )
    }
    const notes = weak.map((run) =>
      run >= unheardTail
        ? `${describe(run)} falls after the music ends.`
        : `${describe(run)} was not heard clearly; check it.`,
    )
    if (trimmed)
      notes.unshift(
        `The sheet covers ${timestamp(times[0])}–${timestamp(lastEnd)} of the song.`,
      )
    return result(times, confidence, true, notes.join(' '), transpose)
  }

  const transpose = chooseTranspose(working, unit, audible, keys)
  const aligned = alignAt(transpose)
  if (aligned.reliable || transpose === 0) return aligned
  // The order-free ranking can be fooled by a sheet that uses the same chords
  // in another key; the sheet as written is the second opinion.
  const inKey = alignAt(0)
  return inKey.reliable || inKey.confidence >= aligned.confidence
    ? inKey
    : aligned
}
