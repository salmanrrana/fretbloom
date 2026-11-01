import type { Server } from 'node:http'
import { spawnSync } from 'node:child_process'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFretBloomServer } from './index.ts'
import type { SongStore, StoredSong } from './songStore.ts'

const openServers: Server[] = []
let fixtureDirectory: string

beforeAll(async () => {
  fixtureDirectory = await mkdtemp(join(tmpdir(), 'fretbloom-frontend-test-'))
  await writeFile(
    join(fixtureDirectory, 'index.html'),
    '<!doctype html><div id="root"></div>',
  )
})
afterAll(async () => {
  await rm(fixtureDirectory, { recursive: true, force: true })
})

afterEach(async () => {
  await Promise.all(openServers.splice(0).map(closeServer))
})

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

async function startServer(options?: {
  accessPassword?: string
  songStore?: SongStore
}): Promise<string> {
  const server = createFretBloomServer(fixtureDirectory, options)
  openServers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Test server did not bind')
  return `http://127.0.0.1:${address.port}`
}

describe('standalone server', () => {
  it('refuses a database-backed start without the owner password', () => {
    const result = spawnSync(process.execPath, ['server/index.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
        FRETBLOOM_ACCESS_PASSWORD: '',
      },
      encoding: 'utf8',
      timeout: 5000,
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('requires FRETBLOOM_ACCESS_PASSWORD')
  })

  it('serves the single-page app for frontend routes', async () => {
    const baseUrl = await startServer()
    const response = await fetch(`${baseUrl}/songbook`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    )
    expect(await response.text()).toContain('<div id="root"></div>')
  })

  it('keeps unknown API routes out of the frontend fallback', async () => {
    const baseUrl = await startServer()
    const response = await fetch(`${baseUrl}/api/unknown`)

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('API route not found')
  })

  it('mounts the YouTube API middleware', async () => {
    const baseUrl = await startServer()
    const response = await fetch(`${baseUrl}/api/youtube-audio/invalid`)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_VIDEO_ID' },
    })
  })

  it('keeps local standalone sessions available without a password', async () => {
    const baseUrl = await startServer()
    const response = await fetch(`${baseUrl}/api/session`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ owner: 'local' })
  })

  it('lets only the owner save, reload, and delete a song', async () => {
    const songs = new Map<string, StoredSong & { revision: number }>()
    const songStore: SongStore = {
      async initialize() {},
      async list() {
        return [...songs.values()]
      },
      async put(song, expectedRevision) {
        const current = songs.get(song.id)
        if ((current?.revision ?? 0) !== expectedRevision) return false
        songs.set(song.id, { ...song, revision: expectedRevision + 1 })
        return true
      },
      async remove(id, expectedRevision) {
        if (songs.get(id)?.revision !== expectedRevision) return false
        songs.delete(id)
        return true
      },
      async close() {},
    }
    const baseUrl = await startServer({
      accessPassword: 'a-long-private-owner-password',
      songStore,
    })
    const auth = {
      Authorization: `Basic ${Buffer.from('salmanrrana:a-long-private-owner-password').toString('base64')}`,
    }
    const song = {
      id: 'song-demo',
      title: 'Demo',
      rawTab: 'G C',
      youtubeId: null,
      steps: [],
      savedAt: Date.now(),
    }

    expect((await fetch(`${baseUrl}/health`)).status).toBe(200)
    expect((await fetch(baseUrl)).status).toBe(200)
    expect((await fetch(`${baseUrl}/listen`)).status).toBe(200)
    expect((await fetch(`${baseUrl}/songbook`)).status).toBe(401)
    expect((await fetch(`${baseUrl}/api/session`)).status).toBe(401)
    expect(
      (
        await fetch(`${baseUrl}/api/session`, {
          headers: {
            Authorization: `Basic ${Buffer.from('owner:a-long-private-owner-password').toString('base64')}`,
          },
        })
      ).status,
    ).toBe(401)
    expect((await fetch(`${baseUrl}/api/songs`)).status).toBe(401)
    expect((await fetch(`${baseUrl}/api/youtube-audio/invalid`)).status).toBe(
      401,
    )
    expect(
      (
        await fetch(`${baseUrl}/api/youtube-audio/invalid`, {
          headers: { ...auth, 'Sec-Fetch-Site': 'cross-site' },
        })
      ).status,
    ).toBe(403)
    expect((await fetch(`${baseUrl}/songbook`, { headers: auth })).status).toBe(
      200,
    )
    expect(
      await (await fetch(`${baseUrl}/api/session`, { headers: auth })).json(),
    ).toEqual({
      owner: 'salmanrrana',
    })
    expect(
      (
        await fetch(`${baseUrl}/api/songs/song-demo`, {
          method: 'PUT',
          headers: {
            ...auth,
            'Content-Type': 'application/json',
            'X-Song-Revision': '0',
          },
          body: JSON.stringify(song),
        })
      ).status,
    ).toBe(200)
    const loaded = await fetch(`${baseUrl}/api/songs`, { headers: auth })
    expect(await loaded.json()).toEqual([{ ...song, revision: 1 }])
    expect(
      (
        await fetch(`${baseUrl}/api/songs/song-demo`, {
          method: 'PUT',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...song, title: 'Unconditional edit' }),
        })
      ).status,
    ).toBe(428)
    expect(
      (
        await fetch(`${baseUrl}/api/songs/song-demo`, {
          method: 'PUT',
          headers: {
            ...auth,
            'Content-Type': 'application/json',
            'X-Song-Revision': '0',
          },
          body: JSON.stringify({ ...song, title: 'Stale edit' }),
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await fetch(`${baseUrl}/api/songs/song-demo`, {
          method: 'DELETE',
          headers: { ...auth, 'X-Song-Revision': '0' },
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await fetch(`${baseUrl}/api/songs/song-demo`, {
          method: 'DELETE',
          headers: { ...auth, 'X-Song-Revision': '1' },
        })
      ).status,
    ).toBe(200)
    expect(
      await (await fetch(`${baseUrl}/api/songs`, { headers: auth })).json(),
    ).toEqual([])
    expect(
      (
        await fetch(`${baseUrl}/api/songs/song-demo`, {
          method: 'PUT',
          headers: {
            ...auth,
            'Content-Type': 'application/json',
            'X-Song-Revision': '1',
          },
          body: JSON.stringify({ ...song, title: 'Resurrected stale edit' }),
        })
      ).status,
    ).toBe(409)
  })
})

describe('analysis access boundary', () => {
  it('authenticates before accepting an upload and rejects cross-site analysis', async () => {
    const base = await startServer({
      accessPassword: 'a-long-test-password-over-20-chars',
    })
    const path =
      '/api/analysis/v1/jobs/38d37608-7f04-48d8-a0a2-6eb6e25237ad/media'
    const unauthorized = await fetch(base + path, {
      method: 'PUT',
      body: 'small disposable upload',
    })
    expect(unauthorized.status).toBe(401)
    const crossSite = await fetch(base + path, {
      method: 'PUT',
      headers: { 'Sec-Fetch-Site': 'cross-site' },
      body: 'small disposable upload',
    })
    expect(crossSite.status).toBe(403)
  })
  it('routes analysis errors to JSON rather than the frontend shell', async () => {
    const base = await startServer()
    const response = await fetch(
      `${base}/api/analysis/v1/jobs/not-a-uuid/audio`,
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_REQUEST' },
    })
  })
})
