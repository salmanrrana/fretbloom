import {
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { Transform } from 'node:stream'
import { clientAddress } from './clientAddress.ts'

const PREFIX = '/api/analysis/v1'
const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const JOB = new RegExp(`^/jobs/${UUID}$`, 'i')
const ARTIFACT = new RegExp(
  `^/jobs/${UUID}/(result|features|audio|media)$`,
  'i',
)
const MAX_SOURCE = 50 * 1024 * 1024
interface Options {
  origin?: string
  now?: () => number
  trustRailwayProxy?: boolean
}
function jsonError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
) {
  if (response.headersSent || response.destroyed) return
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(
    JSON.stringify({ error: { code, message, retryable: status >= 429 } }),
  )
}
function backendOrigin(raw: string) {
  const url = new URL(raw)
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Analysis origin must be a plain loopback HTTP origin')
  }
  return url
}

/** Mount after the owner gate. Only these fixed routes can reach the private Rust listener. */
export function createAnalysisMiddleware(options: Options = {}) {
  const origin = backendOrigin(
    options.origin ??
      process.env.FRETBLOOM_ANALYSIS_ORIGIN ??
      'http://127.0.0.1:5210',
  )
  const now = options.now ?? Date.now
  const rates = new Map<
    string,
    { reset: number; creates: number; polls: number }
  >()
  return (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ): void => {
    const rawPath = request.url?.split('?')[0] ?? ''
    if (rawPath !== '/api/analysis' && !rawPath.startsWith('/api/analysis/'))
      return next()
    response.setHeader('Cache-Control', 'private, no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    const path = rawPath.slice(PREFIX.length)
    const artifact = path.match(ARTIFACT)?.[1]
    const methods =
      path === '/capabilities'
        ? ['GET', 'HEAD']
        : path === '/jobs'
          ? ['POST']
          : JOB.test(path)
            ? ['GET', 'DELETE']
            : artifact === 'media'
              ? ['PUT']
              : artifact === 'audio'
                ? ['GET', 'HEAD']
                : artifact
                  ? ['GET']
                  : []
    if (
      !rawPath.startsWith(`${PREFIX}/`) ||
      methods.length === 0 ||
      request.url?.includes('?')
    ) {
      jsonError(
        response,
        400,
        'INVALID_REQUEST',
        'The analysis route is invalid.',
      )
      return
    }
    if (!request.method || !methods.includes(request.method)) {
      response.setHeader('Allow', methods.join(', '))
      jsonError(
        response,
        405,
        'INVALID_REQUEST',
        'This method is not supported.',
      )
      return
    }
    let crossSite = request.headers['sec-fetch-site'] === 'cross-site'
    if (request.headers.origin) {
      try {
        const supplied = new URL(request.headers.origin)
        const trustedProxy =
          options.trustRailwayProxy ??
          Boolean(process.env.RAILWAY_ENVIRONMENT_ID)
        const secure =
          ('encrypted' in request.socket &&
            request.socket.encrypted === true) ||
          (trustedProxy && request.headers['x-forwarded-proto'] === 'https')
        crossSite ||=
          supplied.protocol !== (secure ? 'https:' : 'http:') ||
          supplied.host !== request.headers.host
      } catch {
        crossSite = true
      }
    }
    if (crossSite) {
      jsonError(
        response,
        403,
        'INVALID_REQUEST',
        'Cross-site analysis requests are not allowed.',
      )
      return
    }
    if (request.headers['content-encoding']) {
      jsonError(
        response,
        400,
        'INVALID_REQUEST',
        'Encoded request bodies are not supported.',
      )
      return
    }
    const current = now()
    const address = clientAddress(request, options.trustRailwayProxy)
    let rate = rates.get(address)
    if (!rate || rate.reset <= current) {
      for (const [key, value] of rates)
        if (value.reset <= current) rates.delete(key)
      if (rates.size >= 4096) {
        const oldest = rates.keys().next().value
        if (oldest !== undefined) rates.delete(oldest)
      }
      rate = { reset: current + 60_000, creates: 0, polls: 0 }
      rates.set(address, rate)
    }
    const creation = path === '/jobs'
    const polling = JOB.test(path) && request.method === 'GET'
    if ((creation && ++rate.creates > 10) || (polling && ++rate.polls > 120)) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((rate.reset - current) / 1000))),
      )
      jsonError(
        response,
        429,
        'RATE_LIMITED',
        'Too many analysis requests. Try again shortly.',
      )
      return
    }
    const maxBody =
      request.method === 'PUT'
        ? MAX_SOURCE
        : request.method === 'POST'
          ? 16 * 1024
          : 0
    const declared = request.headers['content-length']
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBody)) {
      jsonError(
        response,
        maxBody ? 413 : 400,
        maxBody ? 'SOURCE_TOO_LARGE' : 'INVALID_REQUEST',
        'The request body exceeds its limit.',
      )
      return
    }
    const headers: Record<string, string> = {}
    for (const name of ['content-type', 'content-length', 'range'] as const) {
      const value = request.headers[name]
      if (typeof value === 'string') headers[name] = value
    }
    const upstream = httpRequest(new URL(`/v1${path}`, origin), {
      method: request.method,
      headers,
    })
    let bytes = 0
    const limited = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length
        if (bytes > maxBody) callback(new Error('body limit'))
        else callback(null, chunk)
      },
    })
    const fail = (status: number, code: string, message: string) => {
      jsonError(response, status, code, message)
      if (response.headersSent && !response.writableEnded) response.destroy()
    }
    const timer = setTimeout(
      () => {
        upstream.destroy()
        fail(504, 'PROCESSING_TIMEOUT', 'The analysis request timed out.')
      },
      request.method === 'PUT' ? 125_000 : 30_000,
    )
    timer.unref()
    const cleanup = () => {
      clearTimeout(timer)
      request.unpipe(limited)
    }
    const disconnect = () => {
      if (!response.writableFinished) upstream.destroy()
    }
    request.once('aborted', disconnect)
    request.once('error', disconnect)
    response.once('close', () => {
      disconnect()
      cleanup()
    })
    limited.once('error', () => {
      upstream.destroy()
      fail(413, 'SOURCE_TOO_LARGE', 'The request body exceeds its limit.')
      request.resume()
    })
    upstream.once('error', () => {
      cleanup()
      fail(
        503,
        'BACKEND_UNAVAILABLE',
        'The audio analysis service is unavailable.',
      )
    })
    upstream.once('response', (incoming) => {
      const responseCap =
        artifact === 'audio'
          ? 30 * 1024 * 1024
          : artifact === 'features'
            ? 8 * 1024 * 1024
            : artifact === 'result'
              ? 8 * 1024 * 1024
              : 16 * 1024
      if (Number(incoming.headers['content-length'] ?? 0) > responseCap) {
        incoming.destroy()
        fail(
          503,
          'BACKEND_UNAVAILABLE',
          'The analysis response exceeds its limit.',
        )
        return
      }
      for (const name of [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'retry-after',
        'allow',
      ] as const) {
        const value = incoming.headers[name]
        if (typeof value === 'string') response.setHeader(name, value)
      }
      const location = incoming.headers.location
      if (
        location &&
        new RegExp(`^/api/analysis/v1/jobs/${UUID}$`, 'i').test(location)
      )
        response.setHeader('Location', location)
      response.statusCode = incoming.statusCode ?? 503
      let received = 0
      const boundedResponse = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          received += chunk.length
          callback(
            received > responseCap ? new Error('response limit') : null,
            chunk,
          )
        },
      })
      boundedResponse.once('error', () => {
        incoming.destroy()
        response.destroy()
      })
      incoming.once('error', () => response.destroy())
      incoming.once('end', cleanup)
      incoming.pipe(boundedResponse).pipe(response)
    })
    request.pipe(limited).pipe(upstream)
  }
}
