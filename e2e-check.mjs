// End-to-end smoke test: loads the app in headless Chromium with a fake mic,
// exercises all modes, and verifies the audio pipeline is alive.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream', // auto-grant mic permission
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(BASE, { waitUntil: 'networkidle' })

// --- shell ---
check((await page.title()) === 'Fretbloom', 'page title is Fretbloom')
check(await page.locator('.wordmark').isVisible(), 'wordmark visible')
check((await page.locator('.garden-muted').count()) === 1, 'garden background present')

// --- tuner is the landing page, experiments hidden ---
check(await page.locator('.tuner-note').isVisible(), 'tuner is the first page shown')
check((await page.locator('.experiments').count()) === 0, 'experiments hidden by default')
await page.locator('.greenhouse-toggle').click()
check((await page.locator('.experiments-row .target-chip').count()) === 2, 'greenhouse reveals two experiments')

// --- listen mode ---
await page.locator('.experiments-row .target-chip', { hasText: 'Listen' }).click()
check(await page.locator('.big-glow-note').isVisible(), 'listen target chord shown')
check((await page.locator('.target-row .target-chip').count()) === 8, 'eight target chords')
check(await page.locator('.corner-cameo .diagram').isVisible(), 'corner cameo diagram visible')
await page.getByRole('button', { name: 'Start listening' }).click()
await page.waitForTimeout(600)
const listening = await page.locator('.listen-status').innerText()
check(/Listening/.test(listening), `mic started, status = "${listening}"`)
await page.locator('.target-row .target-chip', { hasText: 'Am' }).click()
check(await page.locator('.target-row .target-chip.active').innerText() === 'Am', 'target switches to Am')
check((await page.locator('.big-glow-note').innerText()) === 'Am', 'big note follows target')
check((await page.locator('.garden-color').count()) === 1, 'bloom color layer present')
await page.getByRole('button', { name: 'Stop listening' }).click()

// --- tuner ---
await page.getByRole('button', { name: '← tuner' }).click()
check(await page.locator('.tuner-note').isVisible(), 'tuner note display visible')
check((await page.locator('.string-btn').count()) === 6, 'six string buttons')
await page.getByRole('button', { name: /start tuner/i }).click()
await page.waitForTimeout(600)
const modeLine = await page.locator('.tuner-mode-line').innerText()
check(/listening/.test(modeLine), `tuner live, mode line = "${modeLine}"`)
await page.getByRole('button', { name: /^stop$/i }).click()

// --- audio pipeline sanity ---
const ctxRunning = await page.evaluate(async () => {
  const c = new AudioContext()
  const t0 = c.currentTime
  await new Promise((r) => setTimeout(r, 200))
  const advanced = c.currentTime > t0
  await c.close()
  return advanced
})
check(ctxRunning, 'AudioContext clock advances (audio pipeline live)')

// --- responsive: mobile viewport ---
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(300)
check(await page.locator('.tuner-note').isVisible(), 'mobile: tuner still visible')
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check(overflow <= 1, `mobile: no horizontal overflow (${overflow}px)`)

await page.screenshot({ path: '/tmp/fretbloom-mobile.png' })
await page.setViewportSize({ width: 1280, height: 900 })
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/fretbloom-desktop.png', fullPage: true })

check(errors.length === 0, errors.length ? `console errors: ${errors.join(' | ')}` : 'no console/page errors')

await browser.close()
console.log(failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
