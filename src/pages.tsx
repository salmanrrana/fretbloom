import {
  isRouteErrorResponse,
  Link,
  useOutletContext,
  useRouteError,
} from 'react-router'
import type { GardenContext } from './App'
import { TunerMode } from './components/TunerMode'
import { ListenMode } from './components/ListenMode'
import { SongbookMode } from './components/SongbookMode'

export function TunerPage() {
  const { onBloom } = useOutletContext<GardenContext>()
  return <TunerMode onBloom={onBloom} />
}

export function ListenPage() {
  const { onGlow } = useOutletContext<GardenContext>()
  return <ListenMode onGlow={onGlow} />
}

export function SongbookPage() {
  const { onGlow } = useOutletContext<GardenContext>()
  return <SongbookMode onGlow={onGlow} />
}

export function SongbookAccessError() {
  const error = useRouteError()
  const needsPassword = isRouteErrorResponse(error) && error.status === 401
  return (
    <section className="route-message" aria-labelledby="songbook-access-title">
      <h2 id="songbook-access-title">
        {needsPassword ? 'Your private songbook' : 'Songbook is unavailable'}
      </h2>
      <p>
        {needsPassword
          ? 'Sign in as salmanrrana with your owner password to open Songbook.'
          : 'We couldn’t verify access to Songbook. Try again in a moment.'}
      </p>
      {/* A document request reliably opens the browser's Basic Auth password prompt. */}
      <Link className="route-action" to="/songbook" reloadDocument>
        {needsPassword ? 'Sign in to Songbook' : 'Try again'}
      </Link>
      <p className="route-message-hint">Tuner and Listen are always open.</p>
    </section>
  )
}

export function NotFoundPage() {
  return (
    <section className="route-message" aria-labelledby="not-found-title">
      <h2 id="not-found-title">This page isn’t here</h2>
      <p>Head back to the tuner and keep playing.</p>
      <Link className="route-action" to="/">
        Open tuner
      </Link>
    </section>
  )
}

export function InitialLoading() {
  return (
    <div className="shell">
      <p className="route-message" role="status">
        Opening fretbloom…
      </p>
    </div>
  )
}
