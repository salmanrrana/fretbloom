import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SongStore, StoredSong } from './songStore.ts'

const MAX_BODY_BYTES = 2 * 1024 * 1024

function respond(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

function validSong(value: unknown): value is StoredSong {
  if (!value || typeof value !== 'object') return false
  const song = value as Record<string, unknown>
  return (
    typeof song.id === 'string' &&
    /^song-[a-z0-9-]{1,80}$/.test(song.id) &&
    typeof song.title === 'string' &&
    song.title.length <= 300 &&
    typeof song.rawTab === 'string' &&
    song.rawTab.length <= 200_000 &&
    (song.youtubeId === null ||
      (typeof song.youtubeId === 'string' &&
        /^[A-Za-z0-9_-]{11}$/.test(song.youtubeId))) &&
    Array.isArray(song.steps) &&
    song.steps.length <= 20_000 &&
    typeof song.savedAt === 'number' &&
    Number.isSafeInteger(song.savedAt) &&
    song.savedAt > 0
  )
}

function expectedRevision(request: IncomingMessage): number | null {
  const value = request.headers['x-song-revision']
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) return null
  const revision = Number(value)
  return Number.isSafeInteger(revision) ? revision : null
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

/** Returns true when this request belongs to the song API. */
export async function serveSongApi(
  request: IncomingMessage,
  response: ServerResponse,
  store: SongStore,
): Promise<boolean> {
  let pathname: string
  try {
    pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  } catch {
    respond(response, 400, { error: 'Invalid request URL' })
    return true
  }
  if (pathname !== '/api/songs' && !pathname.startsWith('/api/songs/'))
    return false

  try {
    if (pathname === '/api/songs' && request.method === 'GET') {
      respond(response, 200, await store.list())
      return true
    }
    const match = /^\/api\/songs\/(song-[a-z0-9-]{1,80})$/.exec(pathname)
    if (!match) {
      respond(response, 404, { error: 'Song not found' })
      return true
    }
    const id = match[1]
    const revision = expectedRevision(request)
    if (
      (request.method === 'PUT' || request.method === 'DELETE') &&
      revision === null
    ) {
      respond(response, 428, { error: 'Song revision is required' })
      return true
    }
    if (request.method === 'PUT') {
      let value: unknown
      try {
        value = await readJson(request)
      } catch (error) {
        respond(
          response,
          error instanceof Error && error.message === 'BODY_TOO_LARGE'
            ? 413
            : 400,
          { error: 'Invalid song data' },
        )
        return true
      }
      if (!validSong(value) || value.id !== id) {
        respond(response, 400, { error: 'Invalid song data' })
        return true
      }
      if (!(await store.put(value, revision!))) {
        respond(response, 409, {
          error:
            'Song changed on another device. Reload to see the latest version.',
        })
        return true
      }
      respond(response, 200, { ok: true })
      return true
    }
    if (request.method === 'DELETE') {
      if (!(await store.remove(id, revision!))) {
        respond(response, 409, {
          error:
            'Song changed on another device. Reload to see the latest version.',
        })
        return true
      }
      respond(response, 200, { ok: true })
      return true
    }
    response.setHeader('Allow', 'PUT, DELETE')
    respond(response, 405, { error: 'Method not allowed' })
  } catch (error) {
    console.error('Song storage error:', error)
    respond(response, 503, { error: 'Song storage is unavailable' })
  }
  return true
}
