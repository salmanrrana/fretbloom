import { parseAnalyzedAudio, type AnalyzedAudio } from '../audio/songJob'
import { supportsAutomaticAlignment } from '../audio/analysisCompatibility'
import { AUDIO_ALIGNMENT_VERSION } from '../audio/analysisAdapter'
import {
  array,
  choice,
  number,
  object,
  parseAnalysisResult,
  parseHash,
  parseSource,
  string,
  type AnalysisResult,
  type Source,
} from '../audio/analysisV1'
import { alignmentTarget } from './chordIdentity'
import type { SongLyrics } from './lyrics'
import { type ParsedStep } from './tabParser'
import type { ChordSegment, DetectedNote } from '../audio/songAnalysisTypes'

export interface VideoAnalysis {
  /** Bumped when automatic alignment or its confidence rules change. */
  version: number
  videoId: string
  sequenceKey: string
  duration: number
  notes: DetectedNote[]
  /** Chords heard in the recording, independent of any pasted sheet. */
  chords: ChordSegment[]
  syncReason: string | null
  /** Automatic alignment is stored separately from a user's manual timing. */
  times: number[] | null
  /** End of the matched section for automatic sync; null when not aligned. */
  endTime: number | null
  /** Semitones the recording sits above the pasted sheet; 0 when in key. */
  transpose: number
}

export interface SavedAudioAnalysis {
  analyzedAudio?: AnalyzedAudio
  schemaVersion: 1
  source: Source
  pcmSha256: string
  analysis: AnalysisResult
  sequenceKey: string
  alignment: {
    times: number[] | null
    endTime: number | null
    transpose: number
    reason: string | null
  }
}

export function parseSavedAudioAnalysis(value: unknown): SavedAudioAnalysis {
  const v = object(value),
    a = object(v.alignment)
  const analysis = parseAnalysisResult(v.analysis)
  const times =
    a.times === null
      ? null
      : array(a.times, 600, (v) => number(v, 0, analysis.duration))
  if (times?.some((t, i) => i > 0 && t <= times[i - 1]))
    throw new Error('Invalid saved timing order.')
  const endTime =
    a.endTime === null ? null : number(a.endTime, 0, analysis.duration)
  if (times?.length && (endTime === null || endTime <= times[times.length - 1]))
    throw new Error('Invalid saved section end.')
  return {
    schemaVersion: choice(v.schemaVersion, [1]),
    source: parseSource(v.source),
    pcmSha256: parseHash(v.pcmSha256),
    ...(v.analyzedAudio === undefined
      ? {}
      : {
          analyzedAudio: parseAnalyzedAudio(
            v.analyzedAudio,
            parseHash(v.pcmSha256),
          ),
        }),
    analysis,
    sequenceKey: string(v.sequenceKey, 200_000, 0),
    alignment: {
      times,
      endTime,
      transpose: number(a.transpose, -5, 6, true),
      reason: a.reason === null ? null : string(a.reason, 2000, 0),
    },
  }
}

/** A user-saved song: pasted tab, parsed chords, optional YouTube link. */
export interface SavedSong {
  id: string
  title: string
  rawTab: string
  youtubeId: string | null
  steps: ParsedStep[]
  savedAt: number
  /** Database version; incremented locally when a change is queued. */
  revision?: number
  /**
   * Video sync map from a tap-through: syncTimes[i] is the video time in
   * seconds where step i starts. Absent (or shorter than steps) until the
   * user records one.
   */
  syncTimes?: number[]
  syncSource?: 'manual' | 'automatic'
  videoAnalysis?: VideoAnalysis
  audioAnalysis?: SavedAudioAnalysis
  uploadSource?: { name: string; byteLength: number; pcmSha256: string }
  lyrics?: SongLyrics
}

const KEY = 'fretbloom.songbook.v1'
const PENDING_KEY = 'fretbloom.songbook.pending.v1'
export const VIDEO_ANALYSIS_VERSION = 4

/** The chord sequence a saved automatic analysis was aligned against. */
export function analysisSequenceKey(steps: ParsedStep[]): string {
  return JSON.stringify([
    AUDIO_ALIGNMENT_VERSION,
    steps.map((step) => {
      const target = alignmentTarget(step)
      return [target.kind, target.midis, target.label]
    }),
  ])
}

export type PendingSongChange =
  | { kind: 'put'; song: SavedSong; expectedRevision?: number }
  | { kind: 'delete'; id: string; expectedRevision?: number }

/**
 * Reanalyze saved results made with older confidence rules. Their automatic
 * timing goes with them; a user's manual timing survives.
 */
function withCurrentAnalysis(song: SavedSong): SavedSong {
  if (song.audioAnalysis) {
    try {
      const rich = parseSavedAudioAnalysis(song.audioAnalysis)
      const sourceFits =
        rich.source.kind === 'youtube'
          ? rich.source.videoId === song.youtubeId
          : song.youtubeId === null &&
            song.uploadSource?.pcmSha256 === rich.pcmSha256
      const current =
        sourceFits &&
        supportsAutomaticAlignment(rich.analysis.engineVersion) &&
        rich.sequenceKey === analysisSequenceKey(song.steps)
      if (!current && song.syncSource === 'automatic') {
        const { syncTimes: _times, syncSource: _source, ...rest } = song
        return { ...rest, audioAnalysis: rich }
      }
      return { ...song, audioAnalysis: rich }
    } catch {
      const { audioAnalysis: _invalid, syncTimes, syncSource, ...rest } = song
      return syncSource === 'automatic'
        ? rest
        : { ...rest, syncTimes, syncSource }
    }
  }
  const analysis = song.videoAnalysis
  if (
    !analysis ||
    (analysis.version === VIDEO_ANALYSIS_VERSION &&
      Array.isArray(analysis.chords) &&
      Number.isFinite(analysis.transpose))
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

export function clearLocalSongbook(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Storage may be unavailable in a private browser window.
  }
}

/** Pending writes survive a reload until Postgres confirms them. */
export function loadPendingSongChanges(): PendingSongChange[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(PENDING_KEY) ?? '[]',
    )
    if (!Array.isArray(parsed)) return []
    const changes: unknown[] = parsed
    return changes.filter((change): change is PendingSongChange => {
      if (change === null || typeof change !== 'object') return false
      const value = change as Record<string, unknown>
      if (
        value.expectedRevision !== undefined &&
        (!Number.isSafeInteger(value.expectedRevision) ||
          (value.expectedRevision as number) < 0)
      )
        return false
      if (value.kind === 'delete') return typeof value.id === 'string'
      if (value.kind !== 'put' || !value.song || typeof value.song !== 'object')
        return false
      return typeof (value.song as Record<string, unknown>).id === 'string'
    })
  } catch {
    return []
  }
}

export function savePendingSongChanges(changes: PendingSongChange[]): boolean {
  try {
    if (changes.length)
      localStorage.setItem(PENDING_KEY, JSON.stringify(changes))
    else localStorage.removeItem(PENDING_KEY)
    return true
  } catch {
    return false
  }
}

/** A 404 means this local server has no song database configured. */
export async function loadRemoteSongbook(options?: {
  preserveAnalysis?: boolean
}): Promise<SavedSong[] | null> {
  const response = await fetch('/api/songs', {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  // Local Vite previews can rewrite unknown API paths to HTML. Production
  // Songbook access is checked first by the route loader and fails closed.
  if (response.headers.get('content-type')?.includes('text/html')) return null
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Could not load songs from the database')
  const songs: unknown = await response.json()
  if (!Array.isArray(songs)) throw new Error('Invalid songbook response')
  return options?.preserveAnalysis
    ? (songs as SavedSong[])
    : (songs as SavedSong[]).map(withCurrentAnalysis)
}

export async function saveRemoteSong(
  song: SavedSong,
  expectedRevision: number,
): Promise<void> {
  const body = JSON.stringify(song)
  if (new TextEncoder().encode(body).length > 2 * 1024 * 1024)
    throw new Error(
      'This song is too large to save. Download the detailed analysis instead.',
    )
  const response = await fetch(`/api/songs/${encodeURIComponent(song.id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Song-Revision': String(expectedRevision),
    },
    body,
  })
  if (response.status === 409) throw new SongConflictError()
  if (!response.ok) throw new Error('Could not save song to the database')
}

export class SongConflictError extends Error {
  constructor() {
    super('Song changed on another device')
  }
}

export async function deleteRemoteSong(
  id: string,
  expectedRevision: number,
): Promise<void> {
  const response = await fetch(`/api/songs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Song-Revision': String(expectedRevision) },
  })
  if (response.status === 409) throw new SongConflictError()
  if (!response.ok) throw new Error('Could not delete song from the database')
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    )
  return value
}

/** Retry a journal entry without blocking when its first response was lost after commit. */
export async function applyPendingSongChange(
  change: PendingSongChange,
): Promise<void> {
  const revision = change.expectedRevision
  if (revision === undefined) throw new SongConflictError()
  try {
    if (change.kind === 'put') await saveRemoteSong(change.song, revision)
    else await deleteRemoteSong(change.id, revision)
  } catch (error) {
    if (!(error instanceof SongConflictError)) throw error
    const songs = await loadRemoteSongbook({ preserveAnalysis: true })
    if (songs === null) throw error
    if (change.kind === 'delete') {
      if (!songs.some((song) => song.id === change.id)) return
    } else {
      const remote = songs.find((song) => song.id === change.song.id)
      if (remote?.revision === revision + 1) {
        const { revision: _remoteRevision, ...remoteContent } = remote
        const { revision: _queuedRevision, ...queuedContent } = change.song
        if (
          JSON.stringify(canonical(remoteContent)) ===
          JSON.stringify(canonical(queuedContent))
        )
          return
      }
    }
    throw error
  }
}
