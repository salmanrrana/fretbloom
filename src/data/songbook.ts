import type { SongLyrics } from './lyrics'
import type { ParsedStep } from './tabParser'
import type { ChordSegment, DetectedNote } from '../audio/songAnalysisTypes'

export interface VideoAnalysis {
  videoId: string
  sequenceKey: string
  duration: number
  notes: DetectedNote[]
  /** Chords heard in the recording, independent of any pasted sheet. */
  chords: ChordSegment[]
  syncReason: string | null
  /** Automatic alignment is stored separately from a user's manual timing. */
  times: number[] | null
  /** Semitones the recording sits above the pasted sheet; 0 when in key. */
  transpose: number
}

/** A user-saved song: pasted tab, parsed chords, optional YouTube link. */
export interface SavedSong {
  id: string
  title: string
  rawTab: string
  youtubeId: string | null
  steps: ParsedStep[]
  savedAt: number
  /**
   * Video sync map from a tap-through: syncTimes[i] is the video time in
   * seconds where step i starts. Absent (or shorter than steps) until the
   * user records one.
   */
  syncTimes?: number[]
  syncSource?: 'manual' | 'automatic'
  videoAnalysis?: VideoAnalysis
  lyrics?: SongLyrics
}

const KEY = 'fretbloom.songbook.v1'

/**
 * Analyses saved before chord recognition or transposition existed have no
 * `chords` or `transpose`. Dropping them here means the song is analyzed
 * once more on open, and the automatic timing that came from the old
 * analysis goes with it so the new one can write fresh times. A manual
 * timing map is untouched.
 */
function withCurrentAnalysis(song: SavedSong): SavedSong {
  const analysis = song.videoAnalysis
  if (
    !analysis ||
    (Array.isArray(analysis.chords) && Number.isFinite(analysis.transpose))
  )
    return song
  const { videoAnalysis: _stale, syncTimes, syncSource, ...rest } = song
  return syncSource === 'automatic' ? rest : { ...rest, syncTimes, syncSource }
}

export function loadSongbook(): SavedSong[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? (parsed as SavedSong[]).map(withCurrentAnalysis)
      : []
  } catch {
    return []
  }
}

export function saveSongbook(songs: SavedSong[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(songs))
  } catch {
    // Storage full or blocked — the session still works, it just won't persist.
  }
}
