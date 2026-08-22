// Mobile-specific assertions: overflow, touch targets, safe geometry, tap flows.
import { chromium } from 'playwright'
const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
let failures = 0
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
await page.addInitScript(() => {
  window.__lastMicConstraints = null
  navigator.mediaDevices.enumerateDevices = async () => [
    { kind: 'audioinput', deviceId: 'default', label: 'Default' },
    { kind: 'audioinput', deviceId: 'mic-built-in', label: 'iPhone Microphone' },
    { kind: 'audioinput', deviceId: 'mic-external', label: 'USB Audio Device' },
  ]
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    window.__lastMicConstraints = constraints
    const ctx = new AudioContext()
    const dest = ctx.createMediaStreamDestination()
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'; osc.frequency.value = 110
    const g = ctx.createGain(); g.gain.value = 0.25
    osc.connect(g); g.connect(dest); osc.start()
    return dest.stream
  }
})
await page.goto(BASE, { waitUntil: 'networkidle' })

// no horizontal overflow at common phone widths
for (const w of [390, 375, 360, 320]) {
  await page.setViewportSize({ width: w, height: 844 })
  await page.waitForTimeout(250)
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(o <= 1, `${w}px: no horizontal overflow (${o}px)`)
}
await page.setViewportSize({ width: 390, height: 844 })

// touch targets: strings and mic button >= 44px tall
const stringBox = await page.locator('.string-btn').first().boundingBox()
check(stringBox.height >= 44, `string buttons thumb-sized (${Math.round(stringBox.height)}px)`)
const micBox = await page.locator('.mic-btn').boundingBox()
check(micBox.height >= 44, `mic button thumb-sized (${Math.round(micBox.height)}px)`)
const ghBox = await page.locator('.greenhouse-toggle').boundingBox()
check(ghBox.width >= 44 && ghBox.height >= 44, `greenhouse glyph tappable (${Math.round(ghBox.width)}x${Math.round(ghBox.height)})`)

// greenhouse pill does not overlap footnote text
const geo = await page.evaluate(() => {
  const pill = document.querySelector('.greenhouse-toggle').getBoundingClientRect()
  const note = document.querySelector('.footnote')
  const style = getComputedStyle(note)
  const textLeft = note.getBoundingClientRect().left + parseFloat(style.paddingLeft)
  return { pillRight: pill.right, textLeft }
})
check(geo.pillRight <= geo.textLeft, `footnote text clears greenhouse pill (${Math.round(geo.pillRight)} <= ${Math.round(geo.textLeft)})`)

// inputs are >= 16px so iOS won't zoom on focus
const selSize = await page.locator('.tuner-tuning').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
const a4Size = await page.locator('.a4-input').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
check(selSize >= 16, `tuning select ${selSize}px (no iOS zoom)`)
check(a4Size >= 16, `a4 input ${a4Size}px (no iOS zoom)`)

// start button must be visible in the FIRST viewport, before any scrolling
const startBox = await page.locator('.mic-btn').boundingBox()
check(startBox.y + startBox.height < 844, `start button above the fold (bottom at ${Math.round(startBox.y + startBox.height)}px)`)
check(startBox.y < 420, `start button near the top (${Math.round(startBox.y)}px)`)

// tap flow: start tuner via touch, note appears, bloom rises
await page.locator('.mic-btn').tap()
await page.waitForTimeout(2200)
check((await page.locator('.tuner-note').innerText()).startsWith('A'), 'tap start: note reads A')
const micConstraints = await page.evaluate(() => window.__lastMicConstraints.audio)
check(
  micConstraints.echoCancellation === false && micConstraints.noiseSuppression === false && micConstraints.autoGainControl === false,
  'capture disables speech processing that distorts instruments',
)
check(await page.getByLabel('Choose a microphone').isVisible(), 'microphone picker appears after permission')
await page.getByLabel('Choose a microphone').selectOption('mic-external')
await page.waitForTimeout(500)
const selectedMic = await page.evaluate(() => window.__lastMicConstraints.audio.deviceId?.exact)
check(selectedMic === 'mic-external', 'external microphone can be selected')

// once live, the button shrinks out of the way
const stopBox = await page.locator('.mic-btn').boundingBox()
check(stopBox.width < startBox.width * 0.5, `live button shrinks (${Math.round(startBox.width)}px -> ${Math.round(stopBox.width)}px)`)
const bloom = await page.locator('.garden-color').evaluate((el) => getComputedStyle(el).opacity)
check(parseFloat(bloom) > 0.7, `bloom rises on mobile (${bloom})`)

// tap a string chip to lock
await page.locator('.string-btn').nth(2).tap()
check((await page.locator('.string-btn.locked').count()) === 1, 'tap locks a string')
await page.locator('.string-btn').nth(2).tap()

// Ukulele presets switch the target bank to four physical strings.
await page.getByLabel('Choose a tuning').selectOption('ukulele-standard')
check((await page.locator('.string-btn').count()) === 4, 'ukulele tuning shows four strings')
check((await page.getByLabel('Choose a tuning').inputValue()) === 'ukulele-standard', 'ukulele preset stays selected')

// greenhouse flow by touch
await page.locator('.greenhouse-toggle').tap()
check(await page.locator('.experiments').isVisible(), 'greenhouse opens by tap')
await page.locator('.experiments-row .target-chip', { hasText: 'Songbook' }).tap()
check(await page.locator('.songbook-paste').isVisible(), 'songbook opens by tap')
const oSongbook = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check(oSongbook <= 1, `songbook: no overflow (${oSongbook}px)`)
await page.getByRole('button', { name: '← tuner' }).tap()
check(await page.locator('.tuner-note').isVisible(), 'back to tuner by tap')

// landscape phone: everything still reachable
await page.setViewportSize({ width: 844, height: 390 })
await page.waitForTimeout(300)
check(await page.locator('.mic-btn').isVisible(), 'landscape: mic button visible')
const oLand = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check(oLand <= 1, `landscape: no overflow (${oLand}px)`)

await browser.close()
console.log(failures === 0 ? '\nALL MOBILE CHECKS PASSED' : `\n${failures} FAILED`)
process.exit(failures ? 1 : 0)
