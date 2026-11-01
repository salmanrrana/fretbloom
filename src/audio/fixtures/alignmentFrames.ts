import type { SongAnalysis, SongFrame } from '../songAnalysisTypes'

const HOP = 0.1

/** Exact frames for alignment control flow, independent of any audio recognizer. */
function alignmentFrames(
  runs: readonly { count: number; midis: readonly number[] }[],
): SongAnalysis {
  const frames: SongFrame[] = []
  for (const { count, midis } of runs) {
    for (let index = 0; index < count; index++) {
      const chroma = Array.from({ length: 12 }, () => 0)
      for (const midi of midis) chroma[midi % 12] += 1
      frames.push({
        time: Number((frames.length * HOP).toFixed(1)),
        chroma,
        midi: midis.length === 1 ? midis[0] : null,
        rms: midis.length ? 0.2 : 0,
      })
    }
  }
  return {
    duration: frames.length * HOP,
    hopSeconds: HOP,
    frames,
    notes: [],
    chords: [],
  }
}

export function melodyAlignmentFrames(): SongAnalysis {
  return alignmentFrames([
    { count: 3, midis: [] },
    { count: 7, midis: [69] },
    { count: 7, midis: [72] },
    { count: 7, midis: [76] },
    { count: 3, midis: [] },
  ])
}

export function triadAlignmentFrames(): SongAnalysis {
  return alignmentFrames([
    { count: 3, midis: [] },
    { count: 9, midis: [60, 64, 67] },
    { count: 9, midis: [55, 59, 62] },
    { count: 9, midis: [57, 60, 64] },
    { count: 3, midis: [] },
  ])
}
