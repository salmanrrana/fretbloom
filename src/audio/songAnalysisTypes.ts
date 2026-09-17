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

export interface SongAnalysis {
  duration: number
  hopSeconds: number
  frames: SongFrame[]
  notes: DetectedNote[]
}

export interface SyncTarget {
  /** Actual sounding MIDI notes, including tuning/capo when known. */
  midis: number[]
  kind: 'chord' | 'notes'
}

export interface AlignmentResult {
  times: number[]
  /** Evidence score, not a calibrated probability. */
  confidence: number
  reliable: boolean
  reason: string
}
