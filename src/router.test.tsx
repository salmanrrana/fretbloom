import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from './router'

vi.mock('./components/TunerMode', () => ({
  TunerMode: () => <div>Public tuner</div>,
}))
vi.mock('./components/ListenMode', () => ({
  ListenMode: () => <div>Public listening</div>,
}))
vi.mock('./components/SongbookMode', () => ({
  SongbookMode: () => <div>Private song collection</div>,
}))

const routers: ReturnType<typeof createMemoryRouter>[] = []
const fetchSession = vi.fn<typeof fetch>()

function makeRouter(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  routers.push(router)
  return router
}

function render(router: ReturnType<typeof createMemoryRouter>) {
  return renderToStaticMarkup(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.stubEnv('DEV', false)
  vi.stubGlobal('fetch', fetchSession)
})

afterEach(() => {
  routers.splice(0).forEach((router) => router.dispose())
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  fetchSession.mockReset()
})

describe('page routing', () => {
  it('opens public paths directly and supports history without checking a password', async () => {
    const router = makeRouter('/listen')
    expect(render(router)).toContain('Public listening')
    await router.navigate('/')
    expect(render(router)).toContain('Public tuner')
    await router.navigate(-1)
    expect(render(router)).toContain('Public listening')
    expect(fetchSession).not.toHaveBeenCalled()
  })

  it('keeps private content unmounted while access is pending and after a denied check', async () => {
    let resolveResponse!: (response: Response) => void
    fetchSession.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve
      }),
    )
    const router = makeRouter()
    const navigation = router.navigate('/songbook')
    expect(render(router)).not.toContain('Private song collection')
    resolveResponse(new Response(null, { status: 401 }))
    await navigation
    const html = render(router)
    expect(html).not.toContain('Private song collection')
    expect(html).toContain('Sign in to Songbook')
    expect(html).toContain('href="/songbook"')
    await router.navigate('/listen')
    expect(render(router)).toContain('Public listening')
  })

  it('opens an authorized Songbook and checks again after leaving it', async () => {
    fetchSession.mockImplementation(async () =>
      Response.json({ owner: 'salmanrrana' }),
    )
    const router = makeRouter()
    await router.navigate('/songbook')
    expect(render(router)).toContain('Private song collection')
    expect(fetchSession).toHaveBeenCalledWith(
      '/api/session',
      expect.objectContaining({
        credentials: 'same-origin',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    )
    await router.navigate('/listen')
    fetchSession.mockResolvedValueOnce(new Response(null, { status: 401 }))
    await router.navigate(-1)
    expect(render(router)).toContain('Sign in to Songbook')
    expect(render(router)).not.toContain('Private song collection')
    expect(fetchSession).toHaveBeenCalledTimes(2)
  })

  it.each([
    [
      'a static host returning HTML with status 200',
      () =>
        new Response('<html>App</html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
    ],
    [
      'a static host returning 404 for /api/session',
      () => new Response(null, { status: 404 }),
    ],
    ['invalid session data', () => Response.json({})],
  ])('fails closed in a built app for %s', async (_name, response) => {
    fetchSession.mockResolvedValue(response())
    const router = makeRouter()
    await router.navigate('/songbook')
    expect(render(router)).toContain('Songbook is unavailable')
    expect(render(router)).not.toContain('Private song collection')
  })

  it('shows recovery when the access check cannot reach the server', async () => {
    fetchSession.mockRejectedValue(new TypeError('Failed to fetch'))
    const router = makeRouter()
    await router.navigate('/songbook')
    expect(render(router)).toContain('Try again')
    expect(render(router)).not.toContain('Private song collection')
  })

  it('keeps Vite development usable without an owner server', async () => {
    vi.stubEnv('DEV', true)
    const router = makeRouter()
    await router.navigate('/songbook')
    expect(render(router)).toContain('Private song collection')
    expect(fetchSession).not.toHaveBeenCalled()
  })

  it('offers a tuner link for unknown paths', () => {
    expect(render(makeRouter('/missing'))).toContain('Open tuner')
    expect(fetchSession).not.toHaveBeenCalled()
  })
})
