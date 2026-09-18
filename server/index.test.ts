import type { Server } from 'node:http'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFretBloomServer } from './index.ts'

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

async function startServer(): Promise<string> {
  const server = createFretBloomServer(fixtureDirectory)
  openServers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Test server did not bind')
  return `http://127.0.0.1:${address.port}`
}

describe('standalone server', () => {
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
})
