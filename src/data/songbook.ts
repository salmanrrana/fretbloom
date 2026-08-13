import type { ParsedStep } from './tabParser'

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
}

const KEY = 'fretbloom.songbook.v1'

export function loadSongbook(): SavedSong[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
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
