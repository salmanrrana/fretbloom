import { describe, expect, test } from 'vitest'
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
    for (const interveningFrames of [2, 3, 4]) {
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

  test('returns candidates but rejects silence, broadband noise, and a wrong sequence', () => {
    const silent = alignSong(
      analysis(Array.from({ length: 30 }, (_, index) => silence(index * HOP))),
      [chord(60, 64, 67), chord(55, 59, 62)],
    )
    expect(silent.reliable).toBe(false)
    expect(silent.times).toHaveLength(2)
    expect(silent.reason).toMatch(/too quiet/i)

    const noisyFrames = Array.from({ length: 30 }, (_, index) =>
      frame(index * HOP, [], null, 0.2, 1),
    )
    const noisy = alignSong(analysis(noisyFrames), [
      chord(60, 64, 67),
      chord(55, 59, 62),
    ])
    expect(noisy.reliable).toBe(false)
    expect(noisy.times).toHaveLength(2)

    const wrongOrder = alignSong(
      analysis([
        ...section(0, 5, [57, 60, 64]),
        ...section(0.5, 5, [55, 59, 62]),
        ...section(1, 5, [60, 64, 67]),
      ]),
      [chord(60, 64, 67), chord(55, 59, 62), chord(57, 60, 64)],
    )
    expect(wrongOrder.reliable).toBe(false)
    expect(wrongOrder.times).toHaveLength(3)
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
    expect(aligned.reason).toMatch(/not heard clearly enough/i)
  })

  test('explicitly refuses an unobservable repeated target boundary', () => {
    const aligned = alignSong(analysis(section(0.5, 10, [60, 64, 67])), [
      chord(60, 64, 67),
      chord(60, 64, 67),
    ])

    expect(aligned.times).toHaveLength(2)
    expect(aligned.reliable).toBe(false)
    expect(aligned.confidence).toBeLessThanOrEqual(0.45)
    expect(aligned.reason).toMatch(/sound identical|boundary/i)
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
    expect(aligned.times).toHaveLength(targets.length)
    expect(aligned.reason).toMatch(/600 or fewer/i)
  })

  test('reduces a long analysis before aligning without losing the ordered melody', () => {
    const targets = Array.from({ length: 300 }, (_, index) =>
      note(48 + (index % 25)),
    )
    const frames = targets.flatMap((target, targetIndex) =>
      section(targetIndex * 1.4, 14, target.midis, target.midis[0]),
    )
    // 4,200 frames x 300 targets would exceed the 1.2m-cell work cap.
    const aligned = alignSong(analysis(frames), targets)

    expect(aligned.reliable).toBe(true)
    expect(aligned.times).toHaveLength(targets.length)
    expect(aligned.times[0]).toBeCloseTo(0)
    expect(aligned.times.at(-1)).toBeCloseTo(418.6)
  })
})
