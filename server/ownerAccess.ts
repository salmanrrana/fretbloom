import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { clientAddress } from './clientAddress.ts'

const WINDOW_MS = 60_000
const MAX_FAILURES = 8
const MAX_ADDRESSES = 4096
const OWNER_USERNAME = 'salmanrrana'

function equalSecret(actual: string, expected: string): boolean {
  const actualHash = createHash('sha256').update(actual).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(actualHash, expectedHash)
}

/** One owner password protects the page and every API route on the same origin. */
export function createOwnerAccess(password: string) {
  const failures = new Map<string, { count: number; resetAt: number }>()

  return (request: IncomingMessage, response: ServerResponse): boolean => {
    const address = clientAddress(request)
    const now = Date.now()
    const previous = failures.get(address)
    if (previous && previous.resetAt > now && previous.count >= MAX_FAILURES) {
      response.writeHead(429, {
        'Cache-Control': 'no-store',
        'Retry-After': String(Math.ceil((previous.resetAt - now) / 1000)),
      })
      response.end('Too many sign-in attempts')
      return false
    }

    const header = request.headers.authorization
    let supplied = ''
    if (header?.startsWith('Basic ') && header.length < 4096) {
      try {
        const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
        const separator = decoded.indexOf(':')
        if (separator >= 0 && decoded.slice(0, separator) === OWNER_USERNAME) {
          supplied = decoded.slice(separator + 1)
        }
      } catch {
        // Malformed credentials count as a failed attempt.
      }
    }
    if (supplied && equalSecret(supplied, password)) {
      failures.delete(address)
      return true
    }

    const count = previous && previous.resetAt > now ? previous.count + 1 : 1
    if (failures.size >= MAX_ADDRESSES) {
      for (const [key, entry] of failures) {
        if (entry.resetAt <= now) failures.delete(key)
      }
      if (failures.size >= MAX_ADDRESSES) {
        const oldest = failures.keys().next().value
        if (oldest) failures.delete(oldest)
      }
    }
    failures.set(address, {
      count,
      resetAt:
        previous && previous.resetAt > now ? previous.resetAt : now + WINDOW_MS,
    })
    response.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="FretBloom", charset="UTF-8"',
      'Cache-Control': 'no-store',
    })
    response.end('Sign in required')
    return false
  }
}
