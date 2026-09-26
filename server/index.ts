import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createYouTubeLyricsMiddleware } from './lyrics.ts'
import { createYouTubeCaptionsMiddleware } from './captions.ts'
import { createYouTubeMiddleware } from './youtube.ts'

const DIST_DIRECTORY = resolve(
  fileURLToPath(new URL('../dist/', import.meta.url)),
)

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function writeText(
  response: ServerResponse,
  status: number,
  message: string,
): void {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(message),
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(message)
}

async function findStaticFile(
  pathname: string,
  distDirectory: string,
): Promise<string | undefined> {
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    return undefined
  }

  const requestedPath = resolve(distDirectory, `.${decodedPath}`)
  if (
    requestedPath !== distDirectory &&
    !requestedPath.startsWith(`${distDirectory}${sep}`)
  ) {
    return undefined
  }

  try {
    const requestedStats = await stat(requestedPath)
    if (requestedStats.isFile()) return requestedPath
    if (requestedStats.isDirectory()) {
      const indexPath = resolve(requestedPath, 'index.html')
      if ((await stat(indexPath)).isFile()) return indexPath
    }
  } catch {
    // Missing frontend routes fall through to the single-page app shell.
  }

  return resolve(distDirectory, 'index.html')
}

async function serveFrontend(
  request: IncomingMessage,
  response: ServerResponse,
  distDirectory: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    writeText(response, 405, 'Method not allowed')
    return
  }

  let requestUrl: URL
  try {
    requestUrl = new URL(request.url ?? '/', 'http://localhost')
  } catch {
    writeText(response, 400, 'Invalid request URL')
    return
  }

  if (requestUrl.pathname.startsWith('/api/')) {
    writeText(response, 404, 'API route not found')
    return
  }

  const filePath = await findStaticFile(requestUrl.pathname, distDirectory)
  if (!filePath) {
    writeText(response, 400, 'Invalid request path')
    return
  }

  try {
    const fileStats = await stat(filePath)
    const extension = extname(filePath).toLowerCase()
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
      'Content-Length': fileStats.size,
      'Cache-Control': filePath.includes(`${sep}assets${sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    })
    if (request.method === 'HEAD') response.end()
    else createReadStream(filePath).pipe(response)
  } catch {
    writeText(
      response,
      503,
      'The frontend has not been built. Run npm run build first.',
    )
  }
}

export function createFretBloomServer(distDirectory = DIST_DIRECTORY) {
  const youtube = createYouTubeMiddleware()
  const captions = createYouTubeCaptionsMiddleware()
  const lyrics = createYouTubeLyricsMiddleware()
  return createServer((request, response) => {
    youtube(request, response, () => {
      captions(request, response, () => {
        lyrics(request, response, () => {
          void serveFrontend(request, response, distDirectory)
        })
      })
    })
  })
}

function readPort(value: string | undefined): number {
  const port = Number(value ?? 4173)
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : 4173
}

const isEntryPoint = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false

if (isEntryPoint) {
  const port = readPort(process.env.PORT)
  const host = process.env.HOST ?? '0.0.0.0'
  const server = createFretBloomServer()
  server.listen(port, host, () => {
    console.log(`FretBloom is listening on http://${host}:${port}`)
  })
}
