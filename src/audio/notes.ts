// Note math shared by the synth, tuner and listen mode.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** Open-string MIDI numbers for standard tuning, low E to high e. */
export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64] as const
export const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'] as const

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function freqToMidiFloat(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

export function midiToName(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12]
}

export function midiToNameWithOctave(midi: number): string {
  return `${midiToName(midi)}${Math.floor(midi / 12) - 1}`
}

export interface StringPitchMatch {
  freq: number
  targetMidi: number
  cents: number
}

/**
 * Match a detected pitch to an open string, correcting the common phone-mic
 * case where a string's second or third harmonic is louder than its root.
 */
export function matchStringPitch(
  detectedFreq: number,
  targetMidis: readonly number[],
  referenceA4 = 440,
): StringPitchMatch {
  const calibration = referenceA4 / 440
  const harmonics = [1, 2, 3, 4] as const
  let best: (StringPitchMatch & { score: number }) | null = null

  for (const targetMidi of targetMidis) {
    const targetFreq = midiToFreq(targetMidi) * calibration
    for (const harmonic of harmonics) {
      const freq = detectedFreq / harmonic
      const cents = 1200 * Math.log2(freq / targetFreq)
      const correctionPenalty = harmonic === 1 ? 0 : harmonic === 2 ? 5 : 10
      const score = Math.abs(cents) + correctionPenalty
      if (!best || score < best.score) best = { freq, targetMidi, cents, score }
    }
  }

  if (!best) throw new Error('At least one target string is required.')
  return { freq: best.freq, targetMidi: best.targetMidi, cents: best.cents }
}

export interface PitchReading {
  freq: number
  midi: number
  /** Deviation from the nearest equal-tempered note, in cents (-50..50). */
  cents: number
  name: string
  nameWithOctave: string
}

export function readPitch(freq: number): PitchReading {
  const midiFloat = freqToMidiFloat(freq)
  const midi = Math.round(midiFloat)
  return {
    freq,
    midi,
    cents: Math.round((midiFloat - midi) * 100),
    name: midiToName(midi),
    nameWithOctave: midiToNameWithOctave(midi),
  }
}
