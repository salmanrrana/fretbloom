import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createYouTubeLyricsMiddleware } from './server/lyrics.ts'
import { createYouTubeCaptionsMiddleware } from './server/captions.ts'
import { createYouTubeMiddleware } from './server/youtube.ts'

/** Local Vite runs have no owner account; hosted builds use the real server. */
function localSession(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) {
  if (request.url?.split('?')[0] !== '/api/session') return next()
  if (request.method !== 'GET') {
    response.writeHead(405, { Allow: 'GET' })
    response.end()
    return
  }
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify({ owner: 'local' }))
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'youtube-audio',
      configureServer(server) {
        server.middlewares.use(localSession)
        server.middlewares.use(createYouTubeMiddleware())
        server.middlewares.use(createYouTubeCaptionsMiddleware())
        server.middlewares.use(createYouTubeLyricsMiddleware())
      },
      configurePreviewServer(server) {
        server.middlewares.use(localSession)
        server.middlewares.use(createYouTubeMiddleware())
        server.middlewares.use(createYouTubeCaptionsMiddleware())
        server.middlewares.use(createYouTubeLyricsMiddleware())
      },
    },
  ],
})
