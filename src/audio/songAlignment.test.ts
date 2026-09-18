import { describe, expect, test } from 'vitest'
import {
  CCR_RAIN_RUNS,
  ccrRainAnalysis,
  ccrRainTargets,
} from './fixtures/ccrRain'
import { alignSong } from './songAlignment'
import { analyzeSamples } from './songAnalysis'
import type { SongAnalysis, SongFrame, SyncTarget } from './songAnalysisTypes'

const HOP = 0.1

function chroma(midis: readonly number[], noise = 0): number[] {
  const values = Array.from({ length: 12 }, () => noise)
  for (const midi of midis) values[((midi % 12) + 12) % 12] += 1
  return values
}

function frame(
  time: number,
  midis: readonly number[],
  midi: number | null = null,
  rms = 0.2,
  noise = 0,
): SongFrame {
  return { time, chroma: chroma(midis, noise), midi, rms }
}

function silence(time: number): SongFrame {
  return {
    time,
    chroma: Array.from({ length: 12 }, () => 0),
    midi: null,
    rms: 0.0001,
  }
}

function analysis(frames: SongFrame[]): SongAnalysis {
  return {
    duration: (frames.at(-1)?.time ?? 0) + HOP,
    hopSeconds: HOP,
    frames,
    notes: [],
    chords: [],
  }
}

function chord(...midis: number[]): SyncTarget {
  return { kind: 'chord', midis }
}

function note(midi: number): SyncTarget {
  return { kind: 'notes', midis: [midi] }
}

function notes(...midis: number[]): SyncTarget {
  return { kind: 'notes', midis }
}

function section(
  start: number,
  count: number,
  midis: readonly number[],
  midi: number | null = null,
): SongFrame[] {
  return Array.from({ length: count }, (_, index) =>
    frame(start + index * HOP, midis, midi),
  )
}

describe('alignSong', () => {
  test('finds chord changes after an intro with variable durations and ignores the outro', () => {
    const frames = [
      ...Array.from({ length: 10 }, (_, index) => silence(index * HOP)),
      ...section(1, 4, [60, 64, 67]),
      ...section(1.4, 8, [55, 59, 62]),
      ...section(2.2, 3, [57, 60, 64]),
      ...Array.from({ length: 8 }, (_, index) => silence(2.5 + index * HOP)),
    ]

    const aligned = alignSong(analysis(frames), [
      chord(60, 64, 67),
      chord(55, 59, 62),
      chord(57, 60, 64),
    ])

    expect(aligned.reliable).toBe(true)
    expect(aligned.confidence).toBeGreaterThan(0.9)
    expect(aligned.times).toEqual([1, 1.4, 2.2])
  })

  test('does not join one target across an intervening different chord', () => {
    const c = [60, 64, 67]
    const g = [55, 59, 62]
    // Anything at least a chord's minimum length (0.25 s) counts as a chord;
    // a shorter blip may be bridged as a passing tone the paste omits.
    for (const interveningFrames of [3, 4, 5]) {
      const laterC = 0.4 + interveningFrames * HOP
      const laterG = laterC + 30 * HOP
      const twoTargets = alignSong(
        analysis([
          ...section(0, 4, c),
          ...section(0.4, interveningFrames, g),
          ...section(laterC, 30, c),
          ...section(laterG, 4, g),
        ]),
        [chord(...c), chord(...g)],
      )

      expect(twoTargets.reliable).toBe(true)
      expect(twoTargets.times[0]).toBeCloseTo(laterC)
      expect(twoTargets.times[1]).toBeCloseTo(laterG)
    }

    const fourTargets = alignSong(
      analysis([
        ...section(0, 4, c),
        ...section(0.4, 4, g),
        ...section(0.8, 30, c),
        ...section(3.8, 4, g),
        ...section(4.2, 30, c),
        ...section(7.2, 4, g),
      ]),
      [chord(...c), chord(...g), chord(...c), chord(...g)],
    )

    expect(fourTargets.reliable).toBe(true)
    expect(fourTargets.times).toEqual([0.8, 3.8, 4.2, 7.2])
  })

  test('allows a short unpitched rest between melody targets', () => {
    const aligned = alignSong(
      analysis([
        ...section(0.2, 3, [60], 60),
        ...Array.from({ length: 5 }, (_, index) => silence(0.5 + index * HOP)),
        ...section(1, 3, [64], 64),
      ]),
      [note(60), note(64)],
    )

    expect(aligned.reliable).toBe(true)
    expect(aligned.times).toEqual([0.2, 1])
  })

  test('aligns a monophonic melody using octave-sensitive MIDI evidence', () => {
    const frames = [
      ...section(0.4, 2, [60], 60),
      ...section(0.6, 3, [62], 62),
      ...section(0.9, 2, [64], 64),
      ...section(1.1, 3, [67], 67),
    ]
    const aligned = alignSong(analysis(frames), [
      note(60),
      note(62),
      note(64),
      note(67),
    ])

    expect(aligned.reliable).toBe(true)
    expect(aligned.times).toEqual([0.4, 0.6, 0.9, 1.1])

    const wrongOctave = alignSong(analysis(frames), [
      note(72),
      note(74),
      note(76),
      note(79),
    ])
    expect(wrongOctave.reliable).toBe(false)
    expect(wrongOctave.reason).toMatch(/not heard clearly enough/i)

    // A recording below the sheet must follow too, not only one above it.
    const belowSheet = alignSong(
      analysis([
        ...section(0.4, 2, [58], 58),
        ...section(0.6, 3, [60], 60),
        ...section(0.9, 2, [62], 62),
        ...section(1.1, 3, [65], 65),
      ]),
      [note(60), note(62), note(64), note(67)],
    )
    expect(belowSheet.reliable).toBe(true)
    expect(belowSheet.transpose).toBe(-2)
    expect(belowSheet.times).toEqual([0.4, 0.6, 0.9, 1.1])
  })

  test('aligns simultaneous numbered-tab frets from chroma when MIDI is ambiguous', () => {
    const aligned = alignSong(
      analysis([
        ...section(0.3, 4, [60, 64], null),
        ...section(0.7, 4, [62, 67], null),
        ...section(1.1, 4, [64, 69], null),
      ]),
      [notes(60, 64), notes(62, 67), notes(64, 69)],
    )

    expect(aligned.reliable).toBe(true)
    expect(aligned.times).toEqual([0.3, 0.7, 1.1])
  })

  test('aligns features produced by the real sample analyzer', () => {
    const sampleRate = 12_000
    const tone = (frequency: number, seconds: number): Float32Array =>
      Float32Array.from(
        { length: sampleRate * seconds },
        (_, index) =>
          0.45 * Math.sin((2 * Math.PI * frequency * index) / sampleRate),
      )
    const join = (...parts: Float32Array[]): Float32Array => {
      const joined = new Float32Array(
        parts.reduce((length, part) => length + part.length, 0),
      )
      let offset = 0
      for (const part of parts) {
        joined.set(part, offset)
        offset += part.length
      }
      return joined
    }
    const quiet = new Float32Array(sampleRate * 0.3)
    const extracted = analyzeSamples(
      join(
        quiet,
        tone(440, 0.7),
        tone(523.251, 0.7),
        tone(659.255, 0.7),
        quiet,
      ),
      sampleRate,
    )

    const aligned = alignSong(extracted, [note(69), note(72), note(76)])

    expect(aligned.reliable).toBe(true)
    // The 341ms FFT window sees a note shortly before its waveform onset.
    expect(aligned.times[0]).toBeGreaterThan(0.1)
    expect(aligned.times[0]).toBeLessThan(0.6)
    expect(aligned.times[1]).toBeGreaterThan(0.8)
    expect(aligned.times[1]).toBeLessThan(1.3)
    expect(aligned.times[2]).toBeGreaterThan(1.5)
    expect(aligned.times[2]).toBeLessThan(2)

    const harmony = (midis: number[], seconds: number): Float32Array => {
      const voices = midis.map((midi) =>
        tone(440 * 2 ** ((midi - 69) / 12), seconds),
      )
      return Float32Array.from(
        voices[0],
        (_, index) =>
          voices.reduce((sum, voice) => sum + voice[index], 0) / voices.length,
      )
    }
    const extractedChords = analyzeSamples(
      join(
        quiet,
        harmony([60, 64, 67], 0.9),
        harmony([55, 59, 62], 0.9),
        harmony([57, 60, 64], 0.9),
        quiet,
      ),
      sampleRate,
    )
    const alignedChords = alignSong(extractedChords, [
      chord(60, 64, 67),
      chord(55, 59, 62),
      chord(57, 60, 64),
    ])

    expect(alignedChords.reliable).toBe(true)
    expect(alignedChords.times[0]).toBeLessThan(0.6)
    expect(alignedChords.times[1]).toBeGreaterThan(0.9)
    expect(alignedChords.times[2]).toBeGreaterThan(1.8)
  })

  test('rejects silence, broadband noise, and a wrong sequence', () => {
    const silent = alignSong(
      analysis(Array.from({ length: 30 }, (_, index) => silence(index * HOP))),
      [chord(60, 64, 67), chord(55, 59, 62)],
    )
    expect(silent.reliable).toBe(false)
    expect(silent.times).toEqual([])
    expect(silent.reason).toMatch(/too quiet/i)

    const noisyFrames = Array.from({ length: 30 }, (_, index) =>
      frame(index * HOP, [], null, 0.2, 1),
    )
    const noisy = alignSong(analysis(noisyFrames), [
      chord(60, 64, 67),
      chord(55, 59, 62),
    ])
    expect(noisy.reliable).toBe(false)

    const wrongOrder = alignSong(
      analysis([
        ...section(0, 5, [57, 60, 64]),
        ...section(0.5, 5, [55, 59, 62]),
        ...section(1, 5, [60, 64, 67]),
      ]),
      [chord(60, 64, 67), chord(55, 59, 62), chord(57, 60, 64)],
    )
    expect(wrongOrder.reliable).toBe(false)
  })

  test('rejects a chord sequence supported by only one frame per target', () => {
    const aligned = alignSong(
      analysis([
        frame(0, [60, 64, 67]),
        frame(0.1, [55, 59, 62]),
        frame(0.2, [57, 60, 64]),
      ]),
      [chord(60, 64, 67), chord(55, 59, 62), chord(57, 60, 64)],
    )

    expect(aligned.reliable).toBe(false)
    expect(aligned.reason).toMatch(/too short/i)
  })

  test('splits a repeated chord evenly and stays reliable', () => {
    const aligned = alignSong(analysis(section(0.5, 10, [60, 64, 67])), [
      chord(60, 64, 67),
      chord(60, 64, 67),
    ])

    expect(aligned.reliable).toBe(true)
    expect(aligned.transpose).toBe(0)
    expect(aligned.times).toEqual([0.5, 1])
  })

  test('bounds work for oversized input and asks for a smaller target section', () => {
    const frames = Array.from({ length: 1_000 }, (_, index) =>
      frame(index * HOP, [60, 64, 67]),
    )
    const targets = Array.from({ length: 601 }, (_, index) =>
      note(48 + (index % 24)),
    )
    const aligned = alignSong(analysis(frames), targets)

    expect(aligned.reliable).toBe(false)
    expect(aligned.times).toEqual([])
    expect(aligned.reason).toMatch(/600 or fewer/i)
  })

  test('reduces a long analysis before aligning without losing the ordered melody', () => {
    const targets = Array.from({ length: 600 }, (_, index) =>
      note(48 + (index % 25)),
    )
    const frames = targets.flatMap((target, targetIndex) =>
      section(targetIndex * 1.4, 14, target.midis, target.midis[0]),
    )
    // 8,400 frames x 600 targets exceeds the 4m-cell work cap.
    const started = performance.now()
    const aligned = alignSong(analysis(frames), targets)
    const elapsed = performance.now() - started

    expect(aligned.reliable).toBe(true)
    expect(aligned.times).toHaveLength(targets.length)
    expect(aligned.times[0]).toBeCloseTo(0)
    expect(aligned.times.at(-1)).toBeCloseTo(838.6)
    expect(elapsed).toBeLessThan(3_000)
  })

  test('aligns the CCR chord sheet to the real recording', () => {
    const aligned = alignSong(ccrRainAnalysis(), ccrRainTargets())

    expect(aligned.reliable).toBe(true)
    expect(aligned.transpose).toBe(0)
    expect(aligned.reason).toBe('')
    expect(aligned.times).toHaveLength(68)
    expect(strictlyIncreasing(aligned.times)).toBe(true)
    expect(outsideTolerance(aligned.times)).toEqual([])
  })

  test('follows the real recording when the sheet is written in another key', () => {
    const sheetUpTwo = ccrRainTargets().map((target) => ({
      ...target,
      midis: target.midis.map((midi) => midi + 2),
    }))
    const aligned = alignSong(ccrRainAnalysis(), sheetUpTwo)

    expect(aligned.reliable).toBe(true)
    expect(aligned.transpose).toBe(-2)
    expect(outsideTolerance(aligned.times)).toEqual([])
  })

  test('places a partial sheet on the part it covers and refuses one that skips chords', () => {
    // The first verse alone: C C G C C C G C, sheet steps 5-12.
    const verse = ccrRainTargets().slice(5, 13)
    const aligned = alignSong(ccrRainAnalysis(), verse)

    expect(aligned.reliable).toBe(true)
    expect(aligned.transpose).toBe(0)
    expect(aligned.reason).toBe('The sheet covers 0:04–0:46 of the song.')
    expect(strictlyIncreasing(aligned.times)).toBe(true)
    // The five audible changes, from the first C in the recording.
    const changes = [0, 2, 3, 6, 7].map((step) => aligned.times[step])
    changes.forEach((time, index) =>
      expect(
        Math.abs(time - [4.52, 21.25, 25.26, 38.14, 41.9][index]),
      ).toBeLessThan(0.3),
    )

    // A chorus-only paste has no verse chords, so its C would have to
    // bridge the F at 0:46: refused, naming what was heard.
    const chorus = alignSong(ccrRainAnalysis(), ccrRainTargets().slice(13, 28))
    expect(chorus.reliable).toBe(false)
    expect(chorus.reason).toMatch(/At 0:46 the recording sounds like F/)
  })

  test('tolerates one chord that is not in the recording and names it', () => {
    const targets = ccrRainTargets()
    targets.splice(29, 0, { kind: 'chord', midis: [62, 66, 69], label: 'D' })
    const aligned = alignSong(ccrRainAnalysis(), targets)

    expect(aligned.reliable).toBe(true)
    expect(aligned.reason).toBe('Chord 30 (D) was not heard clearly; check it.')
    const withoutD = [...aligned.times.slice(0, 29), ...aligned.times.slice(30)]
    expect(outsideTolerance(withoutD)).toEqual([])
  })

  test('reports chords pasted past the end of the music', () => {
    const tail = { kind: 'chord' as const, midis: [65, 69, 72], label: 'F' }
    const oneExtra = alignSong(ccrRainAnalysis(), [...ccrRainTargets(), tail])
    expect(oneExtra.reliable).toBe(true)
    expect(oneExtra.reason).toBe('Chord 69 (F) falls after the music ends.')

    const manyExtra = alignSong(ccrRainAnalysis(), [
      ...ccrRainTargets(),
      ...Array.from({ length: 12 }, () => tail),
    ])
    expect(manyExtra.reliable).toBe(false)
    expect(manyExtra.reason).toMatch(/fall after the music ends/)
  })
})

function strictlyIncreasing(times: number[]): boolean {
  return times.every((time, index) => index === 0 || time > times[index - 1])
}

function outsideTolerance(times: number[]) {
  return CCR_RAIN_RUNS.map((run) => ({
    label: run.label,
    error: times[run.firstTarget] - run.start,
    tolerance: run.tolerance,
  })).filter(({ error, tolerance }) => Math.abs(error) > tolerance)
}
