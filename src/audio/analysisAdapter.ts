import type {
  AlignmentFeatures,
  AnalysisResult,
  ResultEnvelope,
  Source,
} from './analysisV1'
import type { SongAnalysis } from './songAnalysisTypes'
import { alignSong } from './songAlignment'
import {
  alignmentTarget,
  parseChordIdentity,
  stepCapo,
} from '../data/chordIdentity'
import type { ParsedStep } from '../data/tabParser'

export const AUDIO_ALIGNMENT_VERSION = 1
export function analysisProjection(
  analysis: AnalysisResult,
): Omit<SongAnalysis, 'frames' | 'hopSeconds'> {
  return {
    duration: analysis.duration,
    notes: analysis.monophonicNotes.map((n) => ({
      start: n.start,
      end: n.end,
      midi: n.midi,
      confidence: n.evidence.score,
    })),
    chords: analysis.harmony.map((e) => ({
      start: e.start,
      end: e.end,
      label: e.kind === 'chord' ? e.primary.label : 'N',
      confidence: e.kind === 'chord' ? e.primary.evidence.score : 0,
    })),
  }
}
export function adaptAnalysis(
  result: ResultEnvelope,
  features: AlignmentFeatures,
): SongAnalysis {
  if (
    result.analysis.engineVersion !== features.engineVersion ||
    Math.abs(result.analysis.duration - features.duration) > 1e-6
  )
    throw new Error(
      'Analysis features belong to a different engine or timeline.',
    )
  return {
    ...analysisProjection(result.analysis),
    frames: features.frames,
    hopSeconds: features.hopSeconds,
  }
}
/** Chroma timing is accepted for extensions/inversions only with independent rich evidence. */
export function alignRichAnalysis(
  result: ResultEnvelope,
  features: AlignmentFeatures,
  steps: ParsedStep[],
) {
  const targets = steps.map(alignmentTarget)
  const alignment = alignSong(adaptAnalysis(result, features), targets)
  if (!alignment.reliable) return alignment
  for (const [index, step] of steps.entries()) {
    if (step.kind === 'notes') continue
    const identity = parseChordIdentity(step.chord.symbol)
    if (!identity)
      return {
        ...alignment,
        reliable: false,
        endTime: null,
        reason: `Automatic timing does not support ${step.chord.symbol}. Set timing manually.`,
      }
    if (
      identity.bassPc === null &&
      (identity.quality === 'maj' || identity.quality === 'min')
    )
      continue
    const shift = alignment.transpose + stepCapo(step)
    const start = alignment.times[index],
      end = alignment.times[index + 1] ?? alignment.endTime ?? start
    const matching = result.analysis.harmony.filter(
      (e) =>
        e.end > start &&
        e.start < end &&
        e.kind === 'chord' &&
        e.primary.chord.rootPc === (identity.rootPc + shift + 120) % 12 &&
        e.primary.chord.quality === identity.quality &&
        e.primary.missingPitchClasses.length === 0 &&
        (identity.bassPc === null ||
          (e.bass !== null &&
            e.bass.evidence.level !== 'low' &&
            e.bass.pitchClass === (identity.bassPc + shift + 120) % 12)),
    )
    const covered = matching.reduce(
      (seconds, e) => seconds + Math.min(end, e.end) - Math.max(start, e.start),
      0,
    )
    const supported =
      covered >= (end - start) * 0.6 &&
      matching.some(
        (e) =>
          e.start <= start + features.hopSeconds * 2 &&
          e.end > start + Math.min(features.hopSeconds, (end - start) / 2),
      )
    if (!supported)
      return {
        ...alignment,
        reliable: false,
        endTime: null,
        reason: `Only harmonic timing could be estimated for ${step.chord.symbol}; its added tones or bass were not resolved. Set timing manually.`,
      }
  }
  return alignment
}

/** Decoded identity, not filename or encoded length, controls timing reuse. */
export function sameRecording(
  a: { source: Source; pcmSha256: string; analysis: { duration: number } },
  b: { source: Source; pcmSha256: string; analysis: { duration: number } },
): boolean {
  const sameOrigin =
    a.source.kind === 'upload'
      ? b.source.kind === 'upload'
      : b.source.kind === 'youtube' && a.source.videoId === b.source.videoId
  return (
    sameOrigin &&
    a.pcmSha256 === b.pcmSha256 &&
    Math.abs(a.analysis.duration - b.analysis.duration) <= 1 / 24000
  )
}
