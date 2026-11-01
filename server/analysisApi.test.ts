import { createServer, request as httpRequest, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { createAnalysisMiddleware } from './analysisApi.ts'
const servers: Server[] = []
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.closeAllConnections()
          s.close(() => resolve())
        }),
    ),
  )
})
async function listen(server: Server) {
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No test port')
  return `http://127.0.0.1:${address.port}`
}
const ID = '38d37608-7f04-48d8-a0a2-6eb6e25237ad'
describe('analysis gateway', () => {
  it('only permits a fixed loopback HTTP origin', () => {
    for (const origin of [
      'https://127.0.0.1:5210',
      'http://example.com',
      'http://user:password@127.0.0.1',
      'http://127.0.0.1/a',
      'http://127.0.0.1/?url=x',
    ])
      expect(() => createAnalysisMiddleware({ origin })).toThrow('loopback')
  })
  it('streams media and ranges while stripping credentials and forwarding headers', async () => {
    let headers: Record<string, string | string[] | undefined> = {}
    let body = ''
    const target = await listen(
      createServer((req, res) => {
        headers = req.headers
        expect(req.url).toBe(`/v1/jobs/${ID}/media`)
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        req.on('end', () => {
          res.writeHead(202, {
            'Content-Type': 'application/json',
            'Set-Cookie': 'nope=x',
            Location: `/api/analysis/v1/jobs/${ID}`,
          })
          res.end('{}')
        })
      }),
    )
    const middleware = createAnalysisMiddleware({ origin: target })
    const gateway = await listen(
      createServer((req, res) =>
        middleware(req, res, () => res.end('fallback')),
      ),
    )
    const result = await fetch(`${gateway}/api/analysis/v1/jobs/${ID}/media`, {
      method: 'PUT',
      headers: {
        Authorization: 'Basic ignored',
        Cookie: 'private=ignored',
        'X-Real-IP': '1.2.3.4',
        'X-Forwarded-Host': 'evil',
        Range: 'bytes=0-4',
        'Content-Type': 'audio/wav',
      },
      body: '12345',
    })
    expect(result.status).toBe(202)
    expect(body).toBe('12345')
    expect(headers.authorization).toBeUndefined()
    expect(headers.cookie).toBeUndefined()
    expect(headers['x-real-ip']).toBeUndefined()
    expect(headers['x-forwarded-host']).toBeUndefined()
    expect(headers.range).toBe('bytes=0-4')
    expect(result.headers.get('set-cookie')).toBeNull()
    expect(result.headers.get('location')).toBe(`/api/analysis/v1/jobs/${ID}`)
    expect(result.headers.get('cache-control')).toBe('private, no-store')
  })
  it('rejects cross-site, unknown routes, query proxies, encoded paths and oversized JSON before contacting Rust', async () => {
    let calls = 0
    const target = await listen(
      createServer((_req, res) => {
        calls++
        res.end('{}')
      }),
    )
    const proxy = createAnalysisMiddleware({ origin: target })
    const gateway = await listen(
      createServer((req, res) => proxy(req, res, () => res.end())),
    )
    expect(
      (
        await fetch(`${gateway}/api/analysis/v1/jobs`, {
          method: 'POST',
          headers: { 'Sec-Fetch-Site': 'cross-site' },
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await fetch(`${gateway}/api/analysis/v1/jobs`, {
          method: 'POST',
          headers: { Origin: 'https://evil.example' },
        })
      ).status,
    ).toBe(403)
    for (const path of [
      '/api/analysis/v1/other',
      '/api/analysis/v1/jobs?url=http://evil',
      `/api/analysis/v1/jobs/%2e%2e/media`,
    ])
      expect((await fetch(gateway + path)).status).toBe(400)
    expect(
      (
        await fetch(`${gateway}/api/analysis/v1/jobs`, {
          method: 'POST',
          body: 'x'.repeat(16385),
        })
      ).status,
    ).toBe(413)
    expect(calls).toBe(0)
  })
  it('rejects chunked bodies at the streaming limit', async () => {
    const target = await listen(
      createServer((req, res) => {
        req.on('error', () => {})
        req.resume()
        req.on('end', () => res.end('{}'))
      }),
    )
    const proxy = createAnalysisMiddleware({ origin: target })
    const gateway = await listen(
      createServer((req, res) => proxy(req, res, () => res.end())),
    )
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        `${gateway}/api/analysis/v1/jobs`,
        { method: 'POST' },
        (res) => {
          res.resume()
          resolve(res.statusCode ?? 0)
        },
      )
      req.on('error', reject)
      req.write('x'.repeat(16385))
      req.end()
    })
    expect(status).toBe(413)
  })
  it('returns JSON 503 for backend absence and limits creation/poll traffic', async () => {
    const unused = createServer()
    const origin = await listen(unused)
    await new Promise<void>((resolve) => unused.close(() => resolve()))
    const proxy = createAnalysisMiddleware({ origin })
    const gateway = await listen(
      createServer((req, res) => proxy(req, res, () => res.end())),
    )
    const response = await fetch(`${gateway}/api/analysis/v1/capabilities`)
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      error: { code: 'BACKEND_UNAVAILABLE' },
    })
    for (let index = 0; index < 10; index++)
      await fetch(`${gateway}/api/analysis/v1/jobs`, { method: 'POST' })
    const limited = await fetch(`${gateway}/api/analysis/v1/jobs`, {
      method: 'POST',
    })
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBeTruthy()
  })
})

it('aborts the upstream upload when its client disconnects', async () => {
  let received: (() => void) | undefined
  let aborted: (() => void) | undefined
  const receiving = new Promise<void>((resolve) => {
    received = resolve
  })
  const disconnected = new Promise<void>((resolve) => {
    aborted = resolve
  })
  const target = await listen(
    createServer((req) => {
      req.once('data', () => received?.())
      req.once('aborted', () => aborted?.())
      req.on('error', () => {})
    }),
  )
  const proxy = createAnalysisMiddleware({ origin: target })
  const gateway = await listen(
    createServer((req, res) => proxy(req, res, () => res.end())),
  )
  const upload = httpRequest(`${gateway}/api/analysis/v1/jobs/${ID}/media`, {
    method: 'PUT',
  })
  upload.on('error', () => {})
  upload.write('partial disposable upload')
  await receiving
  upload.destroy()
  await disconnected
}, 3000)

it('guitar preview permits only GET/HEAD and carries the 30 MiB audio bound', async () => {
  const target = await listen(
    createServer((req, res) => {
      expect(req.url).toBe(`/v1/jobs/${ID}/guitar-audio`)
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': 4 })
      res.end('wave')
    }),
  )
  const proxy = createAnalysisMiddleware({ origin: target })
  const gateway = await listen(
    createServer((req, res) => proxy(req, res, () => res.end())),
  )
  const url = `${gateway}/api/analysis/v1/jobs/${ID}/guitar-audio`
  expect(await (await fetch(url)).text()).toBe('wave')
  expect((await fetch(url, { method: 'HEAD' })).status).toBe(200)
  expect((await fetch(url, { method: 'POST' })).status).toBe(405)
})
