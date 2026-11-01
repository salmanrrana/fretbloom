import type { LoaderFunctionArgs, RouteObject } from 'react-router'
import App from './App'
import {
  InitialLoading,
  ListenPage,
  NotFoundPage,
  SongbookAccessError,
  SongbookPage,
  TunerPage,
} from './pages'

/** The server enforces access; this check keeps private UI out of public navigation. */
async function requireOwner({ request }: LoaderFunctionArgs) {
  // Vite's development middleware has no owner account. Built apps always check.
  if (import.meta.env.DEV) return null

  const response = await fetch('/api/session', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: request.signal,
  })
  // Built apps require a verified session. A static host's 404 or HTML fallback
  // must keep Songbook closed, even when this browser has locally saved songs.
  if (!response.ok) throw new Response(null, { status: response.status })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Response(null, { status: 503 })
  }
  const session: unknown = await response.json()
  if (
    typeof session !== 'object' ||
    session === null ||
    !('owner' in session) ||
    typeof session.owner !== 'string' ||
    !session.owner
  ) {
    throw new Response(null, { status: 503 })
  }
  return null
}

export const routes = [
  {
    path: '/',
    Component: App,
    HydrateFallback: InitialLoading,
    children: [
      { index: true, Component: TunerPage },
      { path: 'listen', Component: ListenPage },
      {
        path: 'songbook',
        loader: requireOwner,
        Component: SongbookPage,
        ErrorBoundary: SongbookAccessError,
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
] satisfies RouteObject[]
