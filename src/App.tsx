import { useCallback, useEffect, useRef } from 'react'
import {
  NavLink,
  Outlet,
  useLocation,
  useMatch,
  useNavigation,
} from 'react-router'

export interface GardenContext {
  onBloom: (level: number, inTune: boolean) => void
  onGlow: (lit: boolean) => void
}

export default function App() {
  const location = useLocation()
  const navigation = useNavigation()
  const isSongbook = Boolean(useMatch('/songbook'))
  const isListen = Boolean(useMatch('/listen'))
  const colorRef = useRef<HTMLDivElement>(null)
  const gardenRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLElement>(null)
  const previousLocation = useRef(location.key)

  /** The tuner updates the flower wall at animation-frame rate. */
  const onBloom = useCallback((level: number, inTune: boolean) => {
    const el = colorRef.current
    if (!el) return
    el.style.opacity = String(Math.max(0, Math.min(1, level)))
    gardenRef.current?.classList.toggle('in-tune', inTune)
  }, [])

  const onGlow = useCallback(
    (lit: boolean) => onBloom(lit ? 1 : 0, lit),
    [onBloom],
  )

  useEffect(() => {
    onBloom(0, false)
    const page = isSongbook
      ? 'Songbook'
      : isListen
        ? 'Listen'
        : location.pathname === '/'
          ? 'Tuner'
          : 'Page not found'
    document.title = `${page} · fretbloom`
    if (previousLocation.current !== location.key) {
      contentRef.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
      previousLocation.current = location.key
    }
  }, [location.key, location.pathname, isSongbook, isListen, onBloom])

  return (
    <>
      <div className="garden" ref={gardenRef} aria-hidden="true">
        <div className="garden-muted" />
        <div className="garden-color" ref={colorRef} />
        <div className="garden-vignette" />
      </div>
      {isSongbook && <div className="songbook-veil" aria-hidden="true" />}

      <div className={`shell${isSongbook ? ' shell-wide' : ''}`}>
        <header className="masthead">
          <div>
            <h1 className="wordmark">fretbloom</h1>
            <p className="tagline">tune it and the wall blooms</p>
          </div>
          <nav className="page-nav" aria-label="Main navigation">
            <NavLink to="/" end>
              Tuner
            </NavLink>
            <NavLink to="/listen">Listen</NavLink>
            <NavLink to="/songbook">Songbook</NavLink>
          </nav>
        </header>

        {navigation.state !== 'idle' && (
          <p className="route-pending" role="status">
            Opening{' '}
            {navigation.location?.pathname === '/songbook'
              ? 'Songbook'
              : 'page'}
            …
          </p>
        )}
        <main className="page-content" ref={contentRef} tabIndex={-1}>
          <Outlet context={{ onBloom, onGlow } satisfies GardenContext} />
        </main>

        <p className="footnote">
          Your microphone stays on this device.
          {isSongbook &&
            ' YouTube audio is fetched through this site’s server.'}
          {isListen &&
            ' Capture music locally from a shared tab or microphone; saved sessions stay on this browser.'}
        </p>
      </div>
    </>
  )
}
