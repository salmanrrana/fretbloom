import type { IncomingMessage } from 'node:http'
import { isIP } from 'node:net'

/** Railway supplies the visitor address after its public edge proxy. */
export function clientAddress(
  request: IncomingMessage,
  trustRailwayProxy = Boolean(process.env.RAILWAY_ENVIRONMENT_ID),
): string {
  const peerAddress = request.socket.remoteAddress ?? 'unknown'
  if (!trustRailwayProxy) return peerAddress

  const realIp = request.headers['x-real-ip']
  return typeof realIp === 'string' && isIP(realIp) ? realIp : peerAddress
}
