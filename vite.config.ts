import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createYouTubeLyricsMiddleware } from './server/lyrics.ts'
import { createYouTubeCaptionsMiddleware } from './server/captions.ts'
import { createYouTubeMiddleware } from './server/youtube.ts'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'youtube-audio',
      configureServer(server) {
        server.middlewares.use(createYouTubeMiddleware())
        server.middlewares.use(createYouTubeCaptionsMiddleware())
        server.middlewares.use(createYouTubeLyricsMiddleware())
      },
      configurePreviewServer(server) {
        server.middlewares.use(createYouTubeMiddleware())
        server.middlewares.use(createYouTubeCaptionsMiddleware())
        server.middlewares.use(createYouTubeLyricsMiddleware())
      },
    },
  ],
})
