import { describe, expect, test } from 'vitest'

import { analyzeSamples } from './songAnalysis'

const SAMPLE_RATE = 12_000

function sine(
  frequency: number,
  seconds: number,
  amplitude = 0.5,
): Float32Array {
  return Float32Array.from(
    { length: Math.round(seconds * SAMPLE_RATE) },
    (_, index) => {
      const fade = Math.min(
        1,
        index / 120,
        (seconds * SAMPLE_RATE - index) / 120,
      )
      return (
        amplitude *
        Math.max(0, fade) *
        Math.sin((2 * Math.PI * frequency * index) / SAMPLE_RATE)
      )
    },
  )
}

function join(...parts: Float32Array[]): Float32Array {
  const result = new Float32Array(
    parts.reduce((length, part) => length + part.length, 0),
  )
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function chord(frequencies: number[], seconds: number): Float32Array {
  const voices = frequencies.map((frequency) =>
    sine(frequency, seconds, 0.7 / frequencies.length),
  )
  return Float32Array.from(voices[0], (_, index) =>
    voices.reduce((sum, voice) => sum + voice[index], 0),
  )
}

function plucked(frequency: number, seconds: number): Float32Array {
  return Float32Array.from(
    { length: Math.round(seconds * SAMPLE_RATE) },
    (_, index) => {
      const time = index / SAMPLE_RATE
      const envelope = Math.exp(-1.8 * time)
      return (
        envelope *
        (0.48 * Math.sin(2 * Math.PI * frequency * time) +
          0.2 * Math.sin(2 * Math.PI * frequency * 2 * time) +
          0.1 * Math.sin(2 * Math.PI * frequency * 3 * time))
      )
    },
  )
}

describe('analyzeSamples', () => {
  test('keeps silence empty and reports finite normalized frames', () => {
    const analysis = analyzeSamples(new Float32Array(SAMPLE_RATE), SAMPLE_RATE)

    expect(analysis.duration).toBe(1)
    expect(analysis.notes).toEqual([])
    expect(analysis.chords.map((chord) => chord.label)).toEqual(['N'])
    expect(analysis.frames.length).toBeGreaterThan(5)
    expect(
      analysis.frames.every((frame) => frame.midi === null && frame.rms === 0),
    ).toBe(true)
    expect(
      analysis.frames.every((frame) =>
        frame.chroma.every((value) => value === 0),
      ),
    ).toBe(true)
  })

  test('finds a clear monophonic melody and groups it into note spans', () => {
    const a4 = sine(440, 0.8)
    const c5 = sine(523.251, 0.8)
    const analysis = analyzeSamples(join(a4, c5), SAMPLE_RATE)

    const midis = new Set(
      analysis.frames
        .map((frame) => frame.midi)
        .filter((midi) => midi !== null),
    )
    expect(midis).toContain(69)
    expect(midis).toContain(72)
    expect(analysis.notes.map((note) => note.midi)).toEqual(
      expect.arrayContaining([69, 72]),
    )
    expect(
      analysis.notes.every(
        (note) => note.confidence >= 0 && note.confidence <= 1,
      ),
    ).toBe(true)
  })

  test('tracks a decaying, overtone-rich guitar-like note', () => {
    const analysis = analyzeSamples(plucked(164.814, 1.2), SAMPLE_RATE)
    const clearFrames = analysis.frames.filter((frame) => frame.rms > 0.03)

    expect(
      clearFrames.filter((frame) => frame.midi === 52).length /
        clearFrames.length,
    ).toBeGreaterThan(0.75)
    expect(
      analysis.notes.some(
        (note) => note.midi === 52 && note.end - note.start > 0.5,
      ),
    ).toBe(true)
  })

  test('keeps chord chroma while refusing to invent one predominant note', () => {
    const analysis = analyzeSamples(
      chord([261.626, 329.628, 391.995], 1.2),
      SAMPLE_RATE,
    )
    const settledFrames = analysis.frames.filter(
      (frame) => frame.time > 0.25 && frame.time < 0.95,
    )
    const average = Array.from(
      { length: 12 },
      (_, pitchClass) =>
        settledFrames.reduce(
          (sum, frame) => sum + frame.chroma[pitchClass],
          0,
        ) / settledFrames.length,
    )
    const strongestClasses = average
      .map((value, pitchClass) => ({ pitchClass, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 3)
      .map(({ pitchClass }) => pitchClass)

    expect(strongestClasses).toEqual(expect.arrayContaining([0, 4, 7]))
    expect(
      settledFrames.filter((frame) => frame.midi === null).length /
        settledFrames.length,
    ).toBeGreaterThan(0.8)
    expect(analysis.notes).toEqual([])
    expect(analysis.chords.map((chord) => chord.label)).toContain('C')
  })

  test('rejects broadband noise as ambiguous', () => {
    let state = 0x12345678
    const noise = Float32Array.from({ length: SAMPLE_RATE * 2 }, () => {
      state = (1664525 * state + 1013904223) >>> 0
      return ((state / 0xffffffff) * 2 - 1) * 0.2
    })
    const analysis = analyzeSamples(noise, SAMPLE_RATE)

    expect(analysis.notes).toEqual([])
    expect(analysis.frames.every((frame) => frame.midi === null)).toBe(true)
  })

  test('supports cancellation and monotonic progress', () => {
    const controller = new AbortController()
    controller.abort()
    expect(() =>
      analyzeSamples(sine(440, 1), SAMPLE_RATE, { signal: controller.signal }),
    ).toThrowError(expect.objectContaining({ name: 'AbortError' }))

    const duringProgress = new AbortController()
    expect(() =>
      analyzeSamples(sine(440, 1), SAMPLE_RATE, {
        signal: duringProgress.signal,
        onProgress: () => duringProgress.abort(),
      }),
    ).toThrowError(expect.objectContaining({ name: 'AbortError' }))

    const progress: number[] = []
    analyzeSamples(sine(440, 1), SAMPLE_RATE, {
      onProgress: (value) => progress.push(value),
    })
    expect(progress[0]).toBe(0)
    expect(progress.at(-1)).toBe(1)
    expect(
      progress.every(
        (value, index) => index === 0 || value >= progress[index - 1],
      ),
    ).toBe(true)
  })

  test('keeps frame growth and work bounded by the hop size', () => {
    const samples = sine(220, 30)
    const started = performance.now()
    const analysis = analyzeSamples(samples, SAMPLE_RATE)
    const elapsed = performance.now() - started

    expect(analysis.frames.length).toBeLessThan(400)
    expect(elapsed).toBeLessThan(3_000)
  })
})
