import { expect, test } from 'vitest'
import type { SavedSong } from '../data/songbook'
import { localSongImports, songValidationError } from './SongbookMode'

function song(overrides: Partial<SavedSong> = {}): SavedSong {
  return {
    id: 'song-original',
    title: 'Original',
    rawTab: 'C G',
    youtubeId: null,
    steps: [],
    savedAt: 1,
    revision: 1,
    ...overrides,
  }
}

test('migration keeps a differing browser edit as a separate song', () => {
  const remote = song({ title: 'Remote title', revision: 4 })
  const cached = song({ title: 'Local title', rawTab: 'Am F' })
  const [copy] = localSongImports([remote], [cached], () => 'song-copy')

  expect(remote).toMatchObject({ id: 'song-original', title: 'Remote title' })
  expect(copy).toMatchObject({
    id: 'song-copy',
    title: 'Local title (local copy)',
    rawTab: 'Am F',
    revision: 1,
  })
  expect(localSongImports([remote, copy], [cached], () => 'song-copy')).toEqual(
    [],
  )
  expect(localSongImports([song({ revision: 7 })], [song()])).toEqual([])
})

test('a song saved before owner mode imports once with a database-safe ID', () => {
  const legacy = song({ id: 'old_browser_123', title: 'My old song' })
  const [imported] = localSongImports([], [legacy])

  expect(imported.title).toBe('My old song')
  expect(imported.id).toMatch(/^song-local-[a-f0-9]{16}$/)
  expect(songValidationError(imported)).toBeNull()
  expect(songValidationError(legacy, true)).toBeNull()
  expect(localSongImports([imported], [legacy])).toEqual([])
})

test('songs beyond API limits are rejected before they can enter the journal', () => {
  expect(songValidationError(song({ title: 'x'.repeat(301) }))).toMatch(/300/)
  expect(songValidationError(song({ rawTab: 'C'.repeat(200_001) }))).toMatch(
    /200,000/,
  )
  expect(songValidationError(song())).toBeNull()
})
