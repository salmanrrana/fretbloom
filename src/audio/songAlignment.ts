import type {
  AlignmentResult,
  SongAnalysis,
  SongFrame,
  SyncTarget,
} from './songAnalysisTypes'

// Traceback is the only target-by-frame allocation. Capping it keeps a long
// recording or a large pasted tab from locking up the browser.
const MAX_DP_CELLS = 1_200_000
const MAX_WORKING_FRAMES = 20_000
const MAX_TARGETS = 600
const MIN_PEAK_RMS = 0.003
const MATCH_FLOOR = 0.55
const STRONG_MATCH = 0.68
const GAP_COST = 0.035
// A tonal mismatch cannot last as long as the shortest accepted chord. That
// prevents a real intervening chord from being treated as transition blur.
const MAX_TONAL_MISMATCH_SECONDS = 0.1
const MAX_UNPITCHED_GAP_SECONDS = 0.75

const TRACE_START = 1
const TRACE_STAY = 2
const TRACE_SKIP = 3
const TRACE_ADVANCE = 4

interface AlignmentPath {
  times: number[]
  matchedFrames: number[][]
}

interface TargetProfile {
  source: SyncTarget
  midis: number[]
  pitchClasses: number[]
  repeatKey: string
}

interface PreparedFrame {
  source: SongFrame
  chromaTotal: number
  chromaMaximum: number
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

function prepareTarget(target: SyncTarget): TargetProfile {
  const midis = target.midis.filter(Number.isFinite).map(Math.round)
  const pitchClasses = [...new Set(midis.map(pitchClass))].sort(
    (left, right) => left - right,
  )
  // Polyphonic tab events can only be compared by pitch class when the pitch
  // detector correctly refuses to choose one note from a chord.
  const repeatKey =
    target.kind === 'chord' || midis.length > 1
      ? `poly:${pitchClasses.join(',')}`
      : `mono:${midis.join(',')}`
  return { source: target, midis, pitchClasses, repeatKey }
}

function prepareFrame(frame: SongFrame): PreparedFrame {
  let chromaTotal = 0
  let chromaMaximum = 0
  for (let pc = 0; pc < 12; pc++) {
    const energy = positive(frame.chroma[pc])
    chromaTotal += energy
    chromaMaximum = Math.max(chromaMaximum, energy)
  }
  return { source: frame, chromaTotal, chromaMaximum }
}

function chromaScore(frame: PreparedFrame, target: TargetProfile): number {
  if (
    target.pitchClasses.length === 0 ||
    frame.chromaTotal === 0 ||
    frame.chromaMaximum === 0
  )
    return 0

  let targetEnergy = 0
  let present = 0
  for (const pc of target.pitchClasses) {
    const energy = positive(frame.source.chroma[pc])
    targetEnergy += energy
    if (energy >= frame.chromaMaximum * 0.1) present++
  }

  const share = targetEnergy / frame.chromaTotal
  const coverage = present / target.pitchClasses.length
  const coveredShare = share * (0.35 + 0.65 * coverage)
  // Uniform noise naturally puts size/12 of its energy in any chord. Remove
  // that chance overlap so broadband audio cannot look like a weak chord.
  const chanceShare = target.pitchClasses.length / 12
  return clamp01((coveredShare - chanceShare) / (1 - chanceShare))
}

function noteScore(frame: PreparedFrame, target: TargetProfile): number {
  if (target.midis.length === 0) return 0

  let pitchEvidence = 0
  if (frame.source.midi !== null && Number.isFinite(frame.source.midi)) {
    let distance = Number.POSITIVE_INFINITY
    for (const midi of target.midis)
      distance = Math.min(distance, Math.abs(frame.source.midi - midi))
    if (distance <= 0.6) pitchEvidence = 1
    else if (distance <= 1.25) pitchEvidence = 0.45
  }

  const spectralEvidence = chromaScore(frame, target)
  if (frame.source.chroma.length < 12) return pitchEvidence * 0.88
  if (target.midis.length > 1) {
    // Simultaneous frets are polyphonic. Chroma is the primary signal and a
    // predominant MIDI, when one exists, only adds octave-sensitive support.
    return 0.25 * pitchEvidence + 0.75 * spectralEvidence
  }
  return 0.72 * pitchEvidence + 0.28 * spectralEvidence
}

function frameEvidence(
  frame: PreparedFrame,
  target: TargetProfile,
  audibleFloor: number,
): number {
  if (!Number.isFinite(frame.source.rms) || frame.source.rms < audibleFloor)
    return 0
  return target.source.kind === 'chord'
    ? chromaScore(frame, target)
    : noteScore(frame, target)
}

function isUnpitched(frame: PreparedFrame, audibleFloor: number): boolean {
  if (frame.source.rms < audibleFloor || frame.chromaTotal === 0) return true
  if (frame.source.midi !== null) return false
  return frame.chromaMaximum / frame.chromaTotal < 0.14
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
  targetCount: number,
): SongFrame[] {
  const maximumFrames = Math.max(
    targetCount,
    Math.min(MAX_WORKING_FRAMES, Math.floor(MAX_DP_CELLS / targetCount)),
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

function fallbackTimes(frames: readonly SongFrame[], count: number): number[] {
  if (frames.length === 0 || count === 0) return []
  const start = frames[0].time
  const end = frames.at(-1)?.time ?? start
  const span = Math.max(0, end - start)
  return Array.from(
    { length: count },
    (_, index) => start + (span * index) / count,
  )
}

function findPath(
  frames: readonly PreparedFrame[],
  targets: readonly TargetProfile[],
  audibleFloor: number,
  hopSeconds: number,
): AlignmentPath | null {
  const targetCount = targets.length
  const trace = new Uint8Array(frames.length * targetCount)
  let previous = new Float64Array(targetCount)
  let current = new Float64Array(targetCount)
  let previousGaps = new Uint32Array(targetCount)
  let currentGaps = new Uint32Array(targetCount)
  previous.fill(Number.NEGATIVE_INFINITY)

  let bestScore = Number.NEGATIVE_INFINITY
  let bestEnd = -1

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
    current.fill(Number.NEGATIVE_INFINITY)
    currentGaps.fill(0)
    for (let targetIndex = 0; targetIndex < targetCount; targetIndex++) {
      const evidence = frameEvidence(
        frames[frameIndex],
        targets[targetIndex],
        audibleFloor,
      )
      const utility = evidence - MATCH_FLOOR
      const unpitched = isUnpitched(frames[frameIndex], audibleFloor)
      const maximumGap = Math.max(
        1,
        Math.floor(
          (unpitched ? MAX_UNPITCHED_GAP_SECONDS : MAX_TONAL_MISMATCH_SECONDS) /
            hopSeconds +
            1e-9,
        ),
      )
      let score = Number.NEGATIVE_INFINITY
      let operation = 0
      let gap = 0

      if (targetIndex === 0 && utility > score) {
        score = utility
        operation = TRACE_START
        gap = evidence >= STRONG_MATCH ? 0 : 1
      }
      const skippedGap = previousGaps[targetIndex] + 1
      if (
        unpitched &&
        skippedGap <= maximumGap &&
        previous[targetIndex] - GAP_COST > score
      ) {
        score = previous[targetIndex] - GAP_COST
        operation = TRACE_SKIP
        gap = skippedGap
      }
      const stayedGap =
        evidence >= STRONG_MATCH ? 0 : previousGaps[targetIndex] + 1
      if (stayedGap <= maximumGap && previous[targetIndex] + utility > score) {
        score = previous[targetIndex] + utility
        operation = TRACE_STAY
        gap = stayedGap
      }
      const advancedGap = evidence >= STRONG_MATCH ? 0 : 1
      if (
        targetIndex > 0 &&
        advancedGap <= maximumGap &&
        previous[targetIndex - 1] + utility > score
      ) {
        score = previous[targetIndex - 1] + utility
        operation = TRACE_ADVANCE
        gap = advancedGap
      }

      current[targetIndex] = score
      currentGaps[targetIndex] = gap
      trace[frameIndex * targetCount + targetIndex] = operation
    }

    if (current[targetCount - 1] > bestScore) {
      bestScore = current[targetCount - 1]
      bestEnd = frameIndex
    }
    const swap = previous
    previous = current
    current = swap
    const gapSwap = previousGaps
    previousGaps = currentGaps
    currentGaps = gapSwap
  }

  if (bestEnd < 0 || !Number.isFinite(bestScore)) return null

  const matchedFrames = Array.from(
    { length: targetCount },
    () => [] as number[],
  )
  let frameIndex = bestEnd
  let targetIndex = targetCount - 1
  while (frameIndex >= 0 && targetIndex >= 0) {
    const operation = trace[frameIndex * targetCount + targetIndex]
    if (operation === TRACE_START) {
      matchedFrames[targetIndex].push(frameIndex)
      break
    }
    if (operation === TRACE_STAY) {
      matchedFrames[targetIndex].push(frameIndex)
      frameIndex--
      continue
    }
    if (operation === TRACE_SKIP) {
      frameIndex--
      continue
    }
    if (operation === TRACE_ADVANCE) {
      matchedFrames[targetIndex].push(frameIndex)
      targetIndex--
      frameIndex--
      continue
    }
    return null
  }

  if (
    targetIndex !== 0 ||
    matchedFrames.some((indices) => indices.length === 0)
  )
    return null
  for (const indices of matchedFrames) indices.reverse()
  return {
    times: matchedFrames.map((indices) => frames[indices[0]].source.time),
    matchedFrames,
  }
}

function firstRepeatedBoundary(targets: readonly TargetProfile[]): number {
  for (let index = 1; index < targets.length; index++) {
    if (targets[index - 1].repeatKey === targets[index].repeatKey) return index
  }
  return -1
}

function result(
  times: number[],
  confidence: number,
  reliable: boolean,
  reason: string,
): AlignmentResult {
  return { times, confidence: clamp01(confidence), reliable, reason }
}

/**
 * Align ordered pasted targets to local recording features. The DP permits an
 * arbitrary intro/outro, variable target duration, and short gaps, while the
 * validation pass refuses alignments supported only by a transient or noise.
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
      fallbackTimes(frames, targets.length),
      0,
      false,
      `This paste has ${targets.length} targets. Sync a section of ${MAX_TARGETS} or fewer at a time.`,
    )
  }
  if (frames.length < targets.length) {
    return result(
      fallbackTimes(frames, targets.length),
      0,
      false,
      'The recording is too short to place every target. Use a longer recording or a shorter paste.',
    )
  }

  let peakRms = 0
  for (const frame of frames) {
    if (Number.isFinite(frame.rms)) peakRms = Math.max(peakRms, frame.rms)
  }
  const audibleFloor = Math.max(0.0015, peakRms * 0.02)
  const reportedHop =
    Number.isFinite(analysis.hopSeconds) && analysis.hopSeconds > 0
      ? analysis.hopSeconds
      : 0
  const observedHop =
    frames.length > 1
      ? (frames.at(-1)!.time - frames[0].time) / (frames.length - 1)
      : 0
  const sourceHop = reportedHop || (observedHop > 0 ? observedHop : 0.05)
  const targetProfiles = targets.map(prepareTarget)
  const reducedFrames = reduceFrames(frames, targets.length)
  const effectiveHop = Math.max(
    0.01,
    sourceHop * (frames.length / reducedFrames.length),
  )
  const workingFrames = reducedFrames.map(prepareFrame)
  const path = findPath(
    workingFrames,
    targetProfiles,
    audibleFloor,
    effectiveHop,
  )
  const candidateTimes = path?.times ?? fallbackTimes(frames, targets.length)

  if (peakRms < MIN_PEAK_RMS) {
    return result(
      candidateTimes,
      0,
      false,
      'The recording is too quiet to hear pitched notes. Use a clearer or louder recording.',
    )
  }
  if (!path) {
    return result(
      candidateTimes,
      0,
      false,
      'The recording does not contain enough ordered evidence to place every target.',
    )
  }

  const targetConfidences = targetProfiles.map((target, targetIndex) => {
    const evidence = path.matchedFrames[targetIndex].map((frameIndex) =>
      frameEvidence(workingFrames[frameIndex], target, audibleFloor),
    )
    const strongFrames = evidence.filter(
      (score) => score >= STRONG_MATCH,
    ).length
    const minimumSeconds = target.source.kind === 'chord' ? 0.12 : 0.07
    const requiredFrames = Math.max(1, Math.ceil(minimumSeconds / effectiveHop))
    const support = clamp01(strongFrames / requiredFrames)
    const mean =
      evidence.reduce((sum, score) => sum + score, 0) / evidence.length
    return mean * support
  })

  const averageConfidence =
    targetConfidences.reduce((sum, score) => sum + score, 0) /
    targetConfidences.length
  const weakestConfidence = Math.min(...targetConfidences)
  const confidence = 0.6 * averageConfidence + 0.4 * weakestConfidence

  const repeatedBoundary = firstRepeatedBoundary(targetProfiles)
  if (repeatedBoundary >= 0) {
    return result(
      candidateTimes,
      Math.min(confidence, 0.45),
      false,
      `Targets ${repeatedBoundary} and ${repeatedBoundary + 1} sound identical, so the automatic matcher cannot place their boundary reliably. Set those times manually in video sync, or use audio with clearly separated attacks.`,
    )
  }

  const weakestTarget = targetConfidences.indexOf(weakestConfidence)
  if (weakestConfidence < 0.58) {
    return result(
      candidateTimes,
      confidence,
      false,
      `Target ${weakestTarget + 1} was not heard clearly enough. Check the pasted notes or use a cleaner recording.`,
    )
  }
  if (confidence < 0.7) {
    return result(
      candidateTimes,
      confidence,
      false,
      'The recording only weakly matches the pasted sequence. Check tuning and use a cleaner recording.',
    )
  }

  return result(
    candidateTimes,
    confidence,
    true,
    'Matched the pasted sequence to the recording.',
  )
}
