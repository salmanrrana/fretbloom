import { beforeEach, expect, test } from 'vitest'
import { loadSongbook, type SavedSong } from './songbook'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  } as Storage
})

function saved(song: Partial<SavedSong>): SavedSong {
  return {
    id: 'song',
    title: 'Song',
    rawTab: 'C G',
    youtubeId: 'video',
    steps: [],
    savedAt: 0,
    ...song,
  }
}

/** A song saved before chord recognition and transposition were stored. */
const stale = {
  videoId: 'video',
  sequenceKey: '[]',
  duration: 10,
  notes: [],
  syncReason: null,
  times: [0, 5],
} as unknown as SavedSong['videoAnalysis']

test('a stale analysis is dropped together with the timing it produced', () => {
  store.set(
    'fretbloom.songbook.v1',
    JSON.stringify([
      saved({
        videoAnalysis: stale,
        syncTimes: [0, 5],
        syncSource: 'automatic',
      }),
      saved({
        id: 'manual',
        videoAnalysis: stale,
        syncTimes: [1, 6],
        syncSource: 'manual',
      }),
      saved({
        id: 'current',
        videoAnalysis: { ...stale!, chords: [], transpose: 0 },
        syncTimes: [0, 5],
        syncSource: 'automatic',
      }),
    ]),
  )
  const [automatic, manual, current] = loadSongbook()

  expect(automatic.videoAnalysis).toBeUndefined()
  expect(automatic.syncTimes).toBeUndefined()
  expect(automatic.syncSource).toBeUndefined()
  expect(manual.videoAnalysis).toBeUndefined()
  expect(manual.syncTimes).toEqual([1, 6])
  expect(manual.syncSource).toBe('manual')
  expect(current.videoAnalysis?.transpose).toBe(0)
  expect(current.syncTimes).toEqual([0, 5])
})
