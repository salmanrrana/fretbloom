// Tuner v2 deep test: fake mic tones drive the full flow — auto string detect,
// manual string lock, alternate tunings, A4 calibration, per-string ✓ tracking.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
let failures = 0
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))

await page.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext()
    const dest = ctx.createMediaStreamDestination()
    let nodes = []
    window.__setMicNotes = (freqs) => {
      nodes.forEach((n) => n.stop())
      nodes = freqs.map((f) => {
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.value = f
        const g = ctx.createGain()
        g.gain.value = 0.25
        osc.connect(g); g.connect(dest); osc.start()
        return osc
      })
    }
    window.__setMicNotes([])
    return dest.stream
  }
})

await page.goto(BASE, { waitUntil: 'networkidle' })

// Landing state: tuner front and center, experiments behind the greenhouse door
check(await page.locator('.tuner-note').isVisible(), 'tuner is the landing page')
check((await page.locator('.experiments').count()) === 0, 'experiments hidden by default')
check((await page.locator('.garden-muted').count()) === 1, 'muted garden layer present')
check((await page.locator('.garden-color').count()) === 1, 'color garden layer present')
const idleOpacity = await page.locator('.garden-color').evaluate((el) => getComputedStyle(el).opacity)
check(parseFloat(idleOpacity) < 0.05, `garden starts muted (color opacity ${idleOpacity})`)
await page.locator('.greenhouse-toggle').click()
check((await page.locator('.experiments-row .target-chip').count()) === 2, 'greenhouse opens with 2 experiments')
check(/rough edges/.test(await page.locator('.experiments-note').innerText()), 'greenhouse notes rough edges')
await page.locator('.greenhouse-toggle').click()
check((await page.locator('.experiments').count()) === 0, 'greenhouse closes again')

await page.getByRole('button', { name: /start tuner/i }).click()
await page.waitForTimeout(300)

// --- auto mode: A2 in tune ---
await page.evaluate(() => window.__setMicNotes([110.0]))
await page.waitForTimeout(1300)
check((await page.locator('.tuner-note').innerText()).startsWith('A'), 'auto detects A string')
check((await page.locator('.tuner-note.in-tune').count()) === 1, 'in-tune state at 110 Hz')
check(/in tune/i.test(await page.locator('.tuner-direction').innerText()), 'direction line confirms in tune')
check((await page.locator('.string-btn.done').count()) >= 1, 'string marked ✓ after stable in-tune')

// --- flat string: direction advice ---
await page.evaluate(() => window.__setMicNotes([106.5])) // ~-56¢... clamps to A string still
await page.waitForTimeout(1000)
check(/tighten|tune up/i.test(await page.locator('.tuner-direction').innerText()), 'flat note says tune up')

// --- sharp string ---
await page.evaluate(() => window.__setMicNotes([113.0]))
await page.waitForTimeout(1000)
check(/loosen|tune down/i.test(await page.locator('.tuner-direction').innerText()), 'sharp note says tune down')

// --- manual string lock: lock high e (index 5), play A2 — cents vs E4 target ---
await page.locator('.string-btn').nth(5).click()
check(/tuning/.test(await page.locator('.tuner-mode-line').innerText()), 'mode line shows locked string')
await page.evaluate(() => window.__setMicNotes([110.0]))
await page.waitForTimeout(900)
const lockedNote = await page.locator('.tuner-note').innerText()
check(lockedNote.startsWith('E'), `locked mode shows target note E (got ${lockedNote})`)
check((await page.locator('.tuner-note.in-tune').count()) === 0, 'A2 vs locked E4 is not in tune')
// unlock by tapping again
await page.locator('.string-btn').nth(5).click()
check(/listening/.test(await page.locator('.tuner-mode-line').innerText()), 'tap again returns to auto (mode line back to listening)')

// --- alternate tuning: Drop D, low string target becomes D2 (73.42 Hz) ---
await page.evaluate(() => window.__setMicNotes([])) // silence so the old tone can't instantly re-earn a ✓
await page.waitForTimeout(300)
await page.locator('.tuner-tuning').selectOption('drop-d')
check((await page.locator('.string-btn.done').count()) === 0, 'tuning change resets ✓ marks')
await page.evaluate(() => window.__setMicNotes([73.42]))
await page.waitForTimeout(1300)
check((await page.locator('.tuner-note').innerText()).startsWith('D'), 'drop D: low string reads D')
check((await page.locator('.tuner-note.in-tune').count()) === 1, 'D2 at 73.42 Hz in tune in drop D')

// In standard, 73.42 Hz would be far from E2 — verify drop-d actually changed the target
await page.locator('.tuner-tuning').selectOption('standard')
await page.evaluate(() => window.__setMicNotes([73.42]))
await page.waitForTimeout(1000)
check((await page.locator('.tuner-note.in-tune').count()) === 0, 'standard: 73.42 Hz not in tune vs E2')

// --- A4 calibration: at A4=432, in-tune A2 is 108.0 Hz ---
await page.locator('.a4-input').fill('432')
await page.evaluate(() => window.__setMicNotes([108.0]))
await page.waitForTimeout(1300)
check((await page.locator('.tuner-note.in-tune').count()) === 1, 'A4=432: 108 Hz reads in tune')
await page.evaluate(() => window.__setMicNotes([110.0]))
await page.waitForTimeout(1000)
const cal = await page.locator('.tuner-freq').innerText()
check((await page.locator('.tuner-note.in-tune').count()) === 0, `A4=432: 110 Hz now sharp (${cal})`)
await page.locator('.a4-input').fill('440')

// --- all six strings → celebration ---
await page.evaluate(() => window.__setMicNotes([]))
await page.waitForTimeout(200)
const freqs = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]
for (const f of freqs) {
  await page.evaluate((x) => window.__setMicNotes([x]), f)
  await page.waitForTimeout(1250)
}
check((await page.locator('.string-btn.done').count()) === 6, 'all six strings marked ✓')
check(await page.locator('.tuner-alltuned').isVisible(), 'all-tuned celebration shows')

// --- strobe ribbon present and animating class logic ---
check((await page.locator('.strobe-ribbon').count()) === 1, 'strobe ribbon present')
check((await page.locator('.strobe-ribbon.in-tune').count()) === 1, 'strobe goes moss when in tune')

// --- THE SIGNATURE: the wall blooms with accuracy ---
// hold an in-tune note, wall should saturate toward full color
await page.evaluate(() => window.__setMicNotes([110.0]))
await page.waitForTimeout(2500)
const bloomIn = await page.locator('.garden-color').evaluate((el) => getComputedStyle(el).opacity)
check(parseFloat(bloomIn) > 0.75, `in tune: wall blooms (opacity ${bloomIn})`)
check((await page.locator('.garden.in-tune').count()) === 1, 'in-tune breathing class applied')
// go way off pitch — wall should wilt back toward muted
await page.evaluate(() => window.__setMicNotes([100.0]))
await page.waitForTimeout(3500)
const bloomOut = await page.locator('.garden-color').evaluate((el) => getComputedStyle(el).opacity)
check(parseFloat(bloomOut) < 0.35, `off pitch: wall wilts (opacity ${bloomOut})`)
check((await page.locator('.garden.in-tune').count()) === 0, 'breathing class removed off pitch')
// silence: bloom decays to zero
await page.evaluate(() => window.__setMicNotes([]))
await page.waitForTimeout(3000)
const bloomSilent = await page.locator('.garden-color').evaluate((el) => getComputedStyle(el).opacity)
check(parseFloat(bloomSilent) < 0.1, `silence: wall rests (opacity ${bloomSilent})`)

await browser.close()
console.log(failures === 0 ? '\nALL TUNER CHECKS PASSED' : `\n${failures} FAILED`)
process.exit(failures ? 1 : 0)
