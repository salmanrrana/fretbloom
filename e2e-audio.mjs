// Deep audio test: patch getUserMedia to feed a synthesized guitar signal
// into the app, then verify listen mode's glow fires for the right chord
// (and not the wrong one) and the tuner reads the right note and cents.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))

// Replace getUserMedia with an oscillator-bank "guitar" we control from the test.
await page.addInitScript(() => {
  window.__setMicNotes = null
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext()
    const dest = ctx.createMediaStreamDestination()
    let nodes = []
    window.__setMicNotes = (freqs) => {
      nodes.forEach((n) => n.osc.stop())
      nodes = freqs.map((f) => {
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth' // harmonic-rich, like a plucked string
        osc.frequency.value = f
        const g = ctx.createGain()
        g.gain.value = 0.2 / Math.max(1, freqs.length / 2)
        osc.connect(g)
        g.connect(dest)
        osc.start()
        return { osc }
      })
    }
    window.__setMicNotes([])
    return dest.stream
  }
})

await page.goto(BASE, { waitUntil: 'networkidle' })

// ---------- LISTEN MODE ----------
await page.locator('.greenhouse-toggle').click()
await page.locator('.experiments-row .target-chip', { hasText: 'Listen' }).click()
await page.getByRole('button', { name: 'Start listening' }).click()
await page.waitForTimeout(400)

// G major open chord: G2 B2 D3 G3 B3 G4
const G = [98.0, 123.47, 146.83, 196.0, 246.94, 392.0]
// F major barre: F2 C3 F3 A3 C4 F4
const F = [87.31, 130.81, 174.61, 220.0, 261.63, 349.23]

// Wrong chord first: play F at a G target — must NOT glow.
await page.evaluate((f) => window.__setMicNotes(f), F)
await page.waitForTimeout(1500)
const wrongGlow = await page.locator('.garden.in-tune').count()
const wrongHit = await page.locator('.corner-cameo.hit').count()
check(wrongGlow === 0 && wrongHit === 0, 'F chord at G target does NOT bloom')

// Now the right chord.
await page.evaluate((g) => window.__setMicNotes(g), G)
await page.waitForTimeout(2000)
const glow = await page.locator('.garden.in-tune').count()
const hit = await page.locator('.corner-cameo.hit').count()
const status = await page.locator('.listen-status').innerText()
check(glow === 1, 'G chord at G target blooms the wall')
check(hit === 1, 'corner cameo turns moss on hit')
check(/ringing/.test(status), `status celebrates: "${status}"`)

// Silence: glow should fade back out.
await page.evaluate(() => window.__setMicNotes([]))
await page.waitForTimeout(2500)
check((await page.locator('.garden.in-tune').count()) === 0, 'bloom fades on silence')

// Switch target to Am and play Am (A2 E3 A3 C4 E4) — should glow again.
await page.locator('.target-row .target-chip', { hasText: 'Am' }).click()
await page.evaluate(() => window.__setMicNotes([110.0, 164.81, 220.0, 261.63, 329.63]))
await page.waitForTimeout(2000)
check((await page.locator('.garden.in-tune').count()) === 1, 'Am chord at Am target blooms')
await page.evaluate(() => window.__setMicNotes([]))
await page.getByRole('button', { name: 'Stop listening' }).click()

// ---------- TUNER ----------
await page.getByRole('button', { name: '← tuner' }).click()
await page.getByRole('button', { name: /start tuner/i }).click()
await page.waitForTimeout(300)

// Perfectly tuned A2 (110 Hz)
await page.evaluate(() => window.__setMicNotes([110.0]))
await page.waitForTimeout(1200)
let note = await page.locator('.tuner-note').innerText()
let freqLine = await page.locator('.tuner-freq').innerText()
check(note === 'A2', `tuner names the note (got "${note}")`)
check((await page.locator('.tuner-note.in-tune').count()) === 1, `in-tune glow at 110 Hz (${freqLine})`)
check((await page.locator('.string-btn.near').count()) === 1, 'matching string chip highlighted')

// Flat A2: 30 cents down = 110 * 2^(-30/1200) ≈ 108.11 Hz
await page.evaluate(() => window.__setMicNotes([108.11]))
await page.waitForTimeout(1200)
note = await page.locator('.tuner-note').innerText()
freqLine = await page.locator('.tuner-freq').innerText()
const centsMatch = freqLine.match(/(-?\d+)¢/)
const cents = centsMatch ? parseInt(centsMatch[1], 10) : NaN
check(note === 'A2', `flat note still reads A2 (got "${note}")`)
check(cents <= -25 && cents >= -35, `cents shows ~-30 flat (got ${cents})`)
check((await page.locator('.tuner-note.in-tune').count()) === 0, 'no in-tune glow when flat')

// Phone mics often hear the second harmonic more strongly than the root.
await page.evaluate(() => window.__setMicNotes([220.0]))
await page.waitForTimeout(1200)
note = await page.locator('.tuner-note').innerText()
freqLine = await page.locator('.tuner-freq').innerText()
check(note === 'A2', `strong A2 harmonic resolves to the open string (got "${note}")`)
check(/^110\./.test(freqLine), `harmonic reading reports the root frequency (${freqLine})`)

// High e string E4
await page.evaluate(() => window.__setMicNotes([329.63]))
await page.waitForTimeout(1200)
note = await page.locator('.tuner-note').innerText()
check(note === 'E4', `high e reads E4 (got "${note}")`)

// Re-entrant ukulele presets use physical string order rather than sorting by pitch.
await page.getByLabel('Choose a tuning').selectOption('ukulele-standard')
await page.evaluate(() => window.__setMicNotes([392.0]))
await page.waitForTimeout(1200)
note = await page.locator('.tuner-note').innerText()
check(note === 'G4', `ukulele high G reads G4 (got "${note}")`)
check((await page.locator('.string-btn').count()) === 4, 'ukulele preset shows four strings')
await page.getByRole('button', { name: /^stop$/i }).click()
await page.evaluate(() => window.__setMicNotes([]))

// ---------- SONGBOOK FOLLOW MODE ----------
// Save a two-chord song, turn the mic follow on, strum G — the sheet should
// hear it, bloom, and advance to D on its own.
await page.locator('.greenhouse-toggle').click()
await page.locator('.experiments-row .target-chip', { hasText: 'Songbook' }).click()
await page.locator('.songbook-input').first().fill('Follow test')
await page.locator('.songbook-paste').fill('[Verse]\nG   D\nHello world')
await page.getByRole('button', { name: 'Save song' }).click()
await page.getByRole('button', { name: 'Listen to me play' }).click()
await page.waitForTimeout(400)
check((await page.locator('.sheet-chord.now').innerText()) === 'G', 'follow mode starts on G')

// G major open chord voicing
await page.evaluate(() => window.__setMicNotes([98.0, 123.47, 146.83, 196.0, 246.94, 392.0]))
await page.waitForTimeout(2500)
check((await page.locator('.sheet-chord.now').innerText()) === 'D', 'strumming G auto-advances the sheet to D')
check((await page.locator('.chord-card.now .chord-name').innerText()) === 'D', 'sidebar card follows to D')

// Keep ringing G at a D target — must NOT advance again.
await page.waitForTimeout(2000)
check((await page.locator('.sheet-chord.now').innerText()) === 'D', 'wrong chord does not advance past D')
await page.evaluate(() => window.__setMicNotes([]))
await page.getByRole('button', { name: 'Stop listening' }).click()

// Clean up the saved song so reruns start fresh.
await page.getByRole('button', { name: '← Songbook' }).click()
await page.locator('.songbook-delete').click()

await browser.close()
console.log(failures === 0 ? '\nALL AUDIO CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
