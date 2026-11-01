import { expect, test } from 'vitest'
import { createSongStore } from './songStore.ts'

const databaseUrl = process.env.SONG_STORE_TEST_DATABASE_URL

test.skipIf(!databaseUrl)(
  'a lost create response cannot resurrect a song deleted by another device',
  async () => {
    const store = createSongStore(databaseUrl!)
    await store.initialize()
    const id = `song-${crypto.randomUUID()}`
    const song = { id, title: 'Original', savedAt: Date.now() }
    try {
      expect(await store.put(song, 0)).toBe(true)
      // Device A never receives the create response. Device B sees revision 1
      // and deletes the song before A retries its original request.
      expect(await store.remove(id, 1)).toBe(true)
      expect(await store.put(song, 0)).toBe(false)
      const staleEdit = { ...song, title: 'Stale edit' }
      expect(await store.put(staleEdit, 1)).toBe(false)
      expect(
        (await store.list()).some(
          (entry) =>
            typeof entry === 'object' &&
            entry !== null &&
            'id' in entry &&
            entry.id === id,
        ),
      ).toBe(false)
    } finally {
      await store.close()
    }
  },
)
