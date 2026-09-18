/** Features extracted locally from a recording, at a regular time interval. */
export interface SongFrame {
  time: number
  chroma: number[]
  /** Estimated predominant MIDI note; null when the signal is ambiguous. */
  midi: number | null
  rms: number
}

export interface DetectedNote {
  midi: number
  start: number
  end: number
  confidence: number
}

/**
 * One stretch of the recording where a single chord sounds, recognized from
 * chroma alone (no pasted sheet needed). Labels use sharps ("C", "Am", "F#m");
 * "N" marks silence or no clear chord.
 */
export interface ChordSegment {
  label: string
  start: number
  end: number
  /** Mean template match along the segment, 0..1. Evidence, not probability. */
  confidence: number
}

export interface SongAnalysis {
  duration: number
  hopSeconds: number
  frames: SongFrame[]
  notes: DetectedNote[]
  chords: ChordSegment[]
}

export interface SyncTarget {
  /** Actual sounding MIDI notes, including tuning/capo when known. */
  midis: number[]
  kind: 'chord' | 'notes'
  /** How the paste spells it ("Am7/G"), so a reason can name the step. */
  label?: string
}

export interface AlignmentResult {
  /** Video time where each pasted target starts, one per target, ascending. */
  times: number[]
  /** Evidence score, not a calibrated probability. */
  confidence: number
  reliable: boolean
  reason: string
  /**
   * Semitones the recording sounds above the pasted sheet, in -5..6. 0 means
   * they agree. When non-zero, `times` were matched with the shifted pitches
   * so the sheet still follows the video; the player can suggest a capo/key.
   */
  transpose: number
}
