import { DEFAULT_OPTIONS } from '../audio/analysisV1'
import { parseTab } from './tabParser'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  analysisSequenceKey,
  applyPendingSongChange,
  saveSongbook,
  deleteRemoteSong,
  loadPendingSongChanges,
  loadRemoteSongbook,
  loadSongbook,
  saveRemoteSong,
  savePendingSongChanges,
  SongConflictError,
  VIDEO_ANALYSIS_VERSION,
  type SavedSong,
} from './songbook'

afterEach(() => vi.unstubAllGlobals())

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
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
        videoAnalysis: {
          ...stale!,
          version: VIDEO_ANALYSIS_VERSION,
          chords: [],
          transpose: 0,
          endTime: null,
        },
        syncTimes: [0, 5],
        syncSource: 'automatic',
      }),
      saved({
        id: 'old-rules',
        videoAnalysis: { ...stale!, version: 1, chords: [], transpose: 0 },
        syncTimes: [0, 5],
        syncSource: 'automatic',
      }),
    ]),
  )
  const [automatic, manual, current, oldRules] = loadSongbook()

  expect(automatic.videoAnalysis).toBeUndefined()
  expect(automatic.syncTimes).toBeUndefined()
  expect(automatic.syncSource).toBeUndefined()
  expect(manual.videoAnalysis).toBeUndefined()
  expect(manual.syncTimes).toEqual([1, 6])
  expect(manual.syncSource).toBe('manual')
  expect(current.videoAnalysis?.transpose).toBe(0)
  expect(current.syncTimes).toEqual([0, 5])
  expect(oldRules.videoAnalysis).toBeUndefined()
  expect(oldRules.syncTimes).toBeUndefined()
})

test('an existing songbook still opens when a static host rewrites the API path to HTML', async () => {
  store.set(
    'fretbloom.songbook.v1',
    JSON.stringify([saved({ title: 'My old song' })]),
  )
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response('<!doctype html>', {
        headers: { 'Content-Type': 'text/html' },
      }),
  )

  expect(await loadRemoteSongbook()).toBeNull()
  expect(loadSongbook()[0].title).toBe('My old song')
})

test('remote edits carry their expected revision and preserve conflicts', async () => {
  const requests: Request[] = []
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(
        new URL(String(input), 'http://localhost'),
        init,
      )
      requests.push(request)
      return new Response('{}', { status: 409 })
    },
  )

  await expect(
    saveRemoteSong(saved({ id: 'song-demo' }), 3),
  ).rejects.toBeInstanceOf(SongConflictError)
  await expect(deleteRemoteSong('song-demo', 3)).rejects.toBeInstanceOf(
    SongConflictError,
  )
  expect(
    requests.map((request) => [
      request.method,
      request.headers.get('x-song-revision'),
    ]),
  ).toEqual([
    ['PUT', '3'],
    ['DELETE', '3'],
  ])
})

test('a committed edit with a lost response drains before the next offline edit', async () => {
  const first = saved({ id: 'song-demo', title: 'First edit', revision: 2 })
  const second = saved({ id: 'song-demo', title: 'Second edit', revision: 3 })
  let remote = saved({ id: 'song-demo', title: 'Original', revision: 1 })
  let loseFirstResponse = true
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(
        new URL(String(input), 'http://localhost'),
        init,
      )
      if (request.method === 'GET') return Response.json([remote])
      const expected = Number(request.headers.get('x-song-revision'))
      if (expected !== remote.revision)
        return Response.json({ error: 'conflict' }, { status: 409 })
      const body = (await request.json()) as SavedSong
      remote = { ...body, revision: expected + 1 }
      if (loseFirstResponse) {
        loseFirstResponse = false
        throw new TypeError('Response lost after commit')
      }
      return Response.json({ ok: true })
    },
  )

  expect(
    savePendingSongChanges([
      { kind: 'put', song: first, expectedRevision: 1 },
      { kind: 'put', song: second, expectedRevision: 2 },
    ]),
  ).toBe(true)
  await expect(
    applyPendingSongChange(loadPendingSongChanges()[0]),
  ).rejects.toThrow('Response lost')
  expect(remote).toMatchObject({ title: 'First edit', revision: 2 })

  // Reload reads the journal, recognizes the already committed first edit,
  // then saves the second edit against the advanced revision.
  const pending = loadPendingSongChanges()
  while (pending.length) {
    await applyPendingSongChange(pending[0])
    pending.shift()
    expect(savePendingSongChanges(pending)).toBe(true)
  }
  expect(loadPendingSongChanges()).toEqual([])
  expect(remote).toMatchObject({ title: 'Second edit', revision: 3 })
})

test('a different remote edit remains a conflict', async () => {
  const queued = saved({ id: 'song-demo', title: 'My edit', revision: 2 })
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
    String(input).endsWith('/api/songs')
      ? Response.json([
          saved({ id: 'song-demo', title: 'Other edit', revision: 2 }),
        ])
      : Response.json({ error: 'conflict' }, { status: 409 }),
  )
  await expect(
    applyPendingSongChange({ kind: 'put', song: queued, expectedRevision: 1 }),
  ).rejects.toBeInstanceOf(SongConflictError)
})

test('a delete already committed before its response was lost drains on retry', async () => {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
    String(input).endsWith('/api/songs')
      ? Response.json([])
      : Response.json({ error: 'conflict' }, { status: 409 }),
  )
  await expect(
    applyPendingSongChange({
      kind: 'delete',
      id: 'song-demo',
      expectedRevision: 2,
    }),
  ).resolves.toBeUndefined()
})

test('rich analysis invalidates stale automatic timing but preserves manual timing and history', async () => {
  const { DEFAULT_OPTIONS } = await import('../audio/analysisV1')
  const { analysisSequenceKey } = await import('./songbook')
  const rich = {
    schemaVersion: 1,
    source: {
      kind: 'upload',
      name: 'practice.wav',
      byteLength: 44,
      contentType: 'audio/wav',
    },
    pcmSha256: 'a'.repeat(64),
    sequenceKey: analysisSequenceKey([]),
    analysis: {
      schemaVersion: 1,
      engineVersion: 'earlier-engine',
      options: DEFAULT_OPTIONS,
      duration: 1,
      sampleRateHz: 24000,
      timingResolutionSeconds: 0.02,
      tuning: { referenceHz: 440, estimatedOffsetCents: null },
      harmony: [],
      monophonicNotes: [],
      polyphonicNotes: [],
      warnings: [],
    },
    alignment: { times: null, endTime: null, transpose: 0, reason: null },
  }
  store.set(
    'fretbloom.songbook.v1',
    JSON.stringify([
      {
        ...saved({ youtubeId: null, syncTimes: [0], syncSource: 'automatic' }),
        audioAnalysis: rich,
        uploadSource: {
          name: 'practice.wav',
          byteLength: 44,
          pcmSha256: rich.pcmSha256,
        },
      },
      {
        ...saved({ youtubeId: null, syncTimes: [0], syncSource: 'manual' }),
        audioAnalysis: rich,
      },
    ]),
  )
  const [automatic, manual] = loadSongbook()
  expect(automatic.audioAnalysis?.analysis.engineVersion).toBe('earlier-engine')
  expect(automatic.syncTimes).toBeUndefined()
  expect(manual.syncTimes).toEqual([0])
  expect(manual.syncSource).toBe('manual')
})

test('invalid rich wire data cannot restore automatic timing or enter the song journal', async () => {
  const { parseSavedAudioAnalysis } = await import('./songbook')
  expect(() => parseSavedAudioAnalysis({ schemaVersion: 2 })).toThrow()
  store.set(
    'fretbloom.songbook.v1',
    JSON.stringify([
      {
        ...saved({ syncSource: 'automatic', syncTimes: [0] }),
        audioAnalysis: { schemaVersion: 2 },
      },
    ]),
  )
  expect(loadSongbook()[0].audioAnalysis).toBeUndefined()
  expect(loadSongbook()[0].syncTimes).toBeUndefined()
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  await expect(
    saveRemoteSong(saved({ title: 'x'.repeat(2 * 1024 * 1024) }), 0),
  ).rejects.toThrow('too large')
  expect(fetcher).not.toHaveBeenCalled()
})

/** A saved upload with an associated sheet, decoded PCM and automatic timing. */
function richTimedSong(engineVersion: string): SavedSong {
  const steps = parseTab('C G').steps
  const uploadSource = {
    name: 'practice.wav',
    byteLength: 44,
    pcmSha256: 'a'.repeat(64),
  }
  return saved({
    youtubeId: null,
    steps,
    uploadSource,
    syncTimes: [1, 5],
    syncSource: 'automatic',
    audioAnalysis: {
      schemaVersion: 1,
      source: {
        kind: 'upload',
        name: uploadSource.name,
        byteLength: 44,
        contentType: 'audio/wav',
      },
      pcmSha256: uploadSource.pcmSha256,
      sequenceKey: analysisSequenceKey(steps),
      analysis: {
        schemaVersion: 1,
        engineVersion,
        options: DEFAULT_OPTIONS,
        duration: 10,
        sampleRateHz: 24000,
        timingResolutionSeconds: 0.02,
        tuning: { referenceHz: 440, estimatedOffsetCents: null },
        harmony: [],
        monophonicNotes: [],
        polyphonicNotes: [],
        warnings: [],
      },
      alignment: { times: [1, 5], endTime: 9, transpose: 0, reason: null },
    },
  })
}

test.each(['rust-dsp-3.1', 'rust-dsp-1'])(
  '%s automatic timing survives local and remote reload without relabeling',
  async (engineVersion) => {
    const upload = richTimedSong(engineVersion)
    const rich = upload.audioAnalysis!
    const songs = [
      upload,
      {
        ...upload,
        youtubeId: 'testaudio01',
        audioAnalysis: {
          ...rich,
          source: { kind: 'youtube', videoId: 'testaudio01' },
        },
      } satisfies SavedSong,
    ]
    saveSongbook(songs)
    vi.stubGlobal('fetch', async () => Response.json(songs))
    for (const restored of [loadSongbook(), await loadRemoteSongbook()]) {
      expect(restored).toHaveLength(2)
      for (const song of restored ?? []) {
        expect(song.syncTimes).toEqual([1, 5])
        expect(song.syncSource).toBe('automatic')
        expect(song.audioAnalysis?.analysis.engineVersion).toBe(engineVersion)
      }
    }
  },
)

test('engine support does not bypass sheet, alignment version, source or PCM association', async () => {
  const base = richTimedSong('rust-dsp-3.1')
  const rich = base.audioAnalysis!
  const staleSongs = [
    { ...richTimedSong('rust-dsp-999'), id: 'unsupported-engine' },
    { ...base, id: 'changed-sheet', steps: parseTab('D E').steps },
    {
      ...base,
      id: 'old-alignment',
      audioAnalysis: {
        ...rich,
        sequenceKey: rich.sequenceKey.replace('[1,', '[0,'),
      },
    },
    {
      ...base,
      id: 'changed-pcm',
      uploadSource: { ...base.uploadSource!, pcmSha256: 'b'.repeat(64) },
    },
    { ...base, id: 'missing-pcm-association', uploadSource: undefined },
    {
      ...base,
      id: 'changed-youtube',
      youtubeId: 'testaudio02',
      audioAnalysis: {
        ...rich,
        source: { kind: 'youtube', videoId: 'testaudio01' },
      },
    },
  ] satisfies SavedSong[]
  const songs = [
    ...staleSongs,
    ...staleSongs.map((song) => ({
      ...song,
      id: `${song.id}-manual`,
      syncSource: 'manual' as const,
    })),
  ]
  saveSongbook(songs)
  vi.stubGlobal('fetch', async () => Response.json(songs))
  for (const restored of [loadSongbook(), await loadRemoteSongbook()]) {
    expect(restored).toHaveLength(songs.length)
    for (const song of restored ?? []) {
      expect(song.audioAnalysis, song.id).toBeDefined()
      if (song.id.endsWith('-manual')) {
        expect(song.syncTimes, song.id).toEqual([1, 5])
        expect(song.syncSource, song.id).toBe('manual')
      } else {
        expect(song.syncTimes, song.id).toBeUndefined()
        expect(song.syncSource, song.id).toBeUndefined()
      }
    }
  }
})
