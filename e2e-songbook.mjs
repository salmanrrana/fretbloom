// Songbook flow: paste a tab + YouTube link, save, follow along on the full
// sheet, mic follow mode, persistence.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
let failures = 0
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

// Serve a stub YouTube player from the real embed origin so the app's
// postMessage handshake (listening → infoDelivery, commands) runs for real.
// The stub plays at 1s of "video" per 100ms of wall time so sync taps are fast.
await ctx.route('https://www.youtube-nocookie.com/embed/**', (route) =>
  route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><script>
      let t = 0, playing = false, timer = null
      const send = () => parent.postMessage(JSON.stringify({
        event: 'infoDelivery', info: { currentTime: t, playerState: playing ? 1 : 2 },
      }), '*')
      window.addEventListener('message', (e) => {
        let d; try { d = JSON.parse(e.data) } catch { return }
        if (d.event === 'listening') { send(); if (!timer) timer = setInterval(() => { if (playing) t += 0.25; send() }, 25) }
        if (d.event === 'command') {
          if (d.func === 'playVideo') playing = true
          if (d.func === 'pauseVideo') playing = false
          if (d.func === 'seekTo') t = d.args[0]
          send()
        }
      })
    </script></body>`,
  }),
)

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.locator('.greenhouse-toggle').click()
check((await page.locator('.experiments-row .target-chip').count()) === 2, 'greenhouse holds two experiments')

await page.locator('.experiments-row .target-chip', { hasText: 'Songbook' }).click()
check(await page.locator('.songbook-paste').isVisible(), 'editor opens when songbook is empty')

// Paste a real-world-shaped tab
const TAB = `[Intro]
G  D  Am  Am

[Verse]
G                D
Standing on a beach
Am
With a gun in my hand
C          F#m        G
Staring at the sea, staring at the sand`

await page.locator('.songbook-input').first().fill('Killing An Arab (test)')
await page.locator('.songbook-input').nth(1).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
await page.locator('.songbook-paste').fill(TAB)
const preview = await page.locator('.songbook-preview').innerText()
check(/Found/.test(preview) && /chords/.test(preview), `live preview shows count: "${preview.slice(0, 60)}..."`)
check(/F#m/.test(preview), 'preview includes barre chord F#m')

await page.getByRole('button', { name: 'Save song' }).click()

// --- full sheet view ---
check(await page.locator('.sheet').isVisible(), 'saving opens the full-sheet player')
const sheetText = await page.locator('.sheet').innerText()
check(/Standing on a beach/.test(sheetText), 'lyrics visible in the sheet')
check(/Staring at the sea/.test(sheetText), 'whole tab rendered (last lyric line present)')
check((await page.locator('.sheet-line.section').count()) === 2, 'section headers rendered')
check((await page.locator('.sheet-chord').count()) === 10, 'every chord occurrence is a chip (10 incl. repeats)')

// First chord lit in the sheet and mirrored in the sidebar card
check((await page.locator('.sheet-chord.now').innerText()) === 'G', 'first chord G lit on the sheet')
check((await page.locator('.chord-card.now .chord-name').innerText()) === 'G', 'sidebar card shows G')
check((await page.locator('.video-frame iframe').count()) === 1, 'youtube iframe embedded')
const src = await page.locator('.video-frame iframe').getAttribute('src')
check(src.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'), 'privacy-enhanced embed URL')
check(/Intro/i.test(await page.locator('.chord-card.now .role').innerText()), 'section label shown')

// Advance via button
await page.getByRole('button', { name: 'next →' }).click()
check((await page.locator('.chord-card.now .chord-name').innerText()) === 'D', 'next button advances G -> D')
check((await page.locator('.sheet-chord.now').innerText()) === 'D', 'sheet highlight follows to D')

// Advance via keyboard
await page.keyboard.press('ArrowRight')
check((await page.locator('.chord-card.now .chord-name').innerText()) === 'Am', 'ArrowRight advances D -> Am')
await page.keyboard.press('ArrowLeft')
check((await page.locator('.chord-card.now .chord-name').innerText()) === 'D', 'ArrowLeft goes back')

// Jump via the sheet to F#m — a generated barre shape
await page.locator('.sheet-chord', { hasText: /^F#m$/ }).click()
check((await page.locator('.chord-card.now .chord-name').innerText()) === 'F#m', 'sheet tap jumps to F#m')
check(await page.locator('.chord-card.now .diagram').isVisible(), 'barre chord renders a diagram')
const tabText = await page.locator('.chord-card.now .tab-block').innerText()
check(/2/.test(tabText) && /4/.test(tabText), `F#m tab shows barre frets (${tabText.replace(/\n/g, ' ')})`)

// Mic follow mode starts listening
await page.getByRole('button', { name: 'Listen to me play' }).click()
await page.waitForTimeout(500)
const status = await page.locator('.songbook-listen-status').innerText()
check(/Strum/.test(status), `mic follow live, status = "${status.slice(0, 50)}"`)
check(await page.locator('.match-meter').isVisible(), 'match meter visible while listening')
await page.getByRole('button', { name: 'Stop listening' }).click()

// --- video sync: tap-through recording ---
check(await page.locator('.sync-btn').isVisible(), 'sync button offered for video songs')
await page.locator('.sync-btn').click()
await page.waitForTimeout(600) // handshake + playback start
check(await page.locator('.sync-recording').isVisible(), 'recording panel appears')
check((await page.locator('.sheet-chord.now').innerText()) === 'G', 'recording starts at first chord')

// Tap through all 10 steps (stub video advances 2.5s per wall-second)
for (let i = 0; i < 10; i++) {
  await page.locator('.sync-recording .play-btn').click()
  await page.waitForTimeout(120)
}
check((await page.locator('.sync-recording').count()) === 0, 'recording completes after last tap')
check(/synced to video/.test(await page.locator('.sync-status').innerText()), 'sync badge shown')

// --- video follow: play the video, highlights track its clock ---
await page.evaluate(() => {
  document.querySelector('.video-frame iframe').contentWindow.postMessage(
    JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }), '*')
  document.querySelector('.video-frame iframe').contentWindow.postMessage(
    JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*')
})
await page.waitForTimeout(400)
const early = await page.locator('.sheet-chord.now').innerText()
await page.waitForTimeout(2500)
const later = await page.locator('.sheet-chord.now').innerText()
const laterIdx = await page.locator('.sheet-chord.now').getAttribute('data-step')
check(early === 'G', `follow starts at G (got ${early})`)
check(Number(laterIdx) > 0, `highlight advances with the video clock (${early} -> ${later}, step ${laterIdx})`)

// Sheet tap seeks the video
await page.locator('.sheet-chord', { hasText: /^F#m$/ }).click()
await page.waitForTimeout(300)
const seeked = await page.evaluate(() => new Promise((resolve) => {
  const onMsg = (e) => {
    try {
      const d = JSON.parse(e.data)
      if (d.event === 'infoDelivery') { window.removeEventListener('message', onMsg); resolve(d.info.currentTime) }
    } catch {}
  }
  window.addEventListener('message', onMsg)
}))
check(typeof seeked === 'number' && seeked > 0, `sheet tap seeks the video (t=${Number(seeked).toFixed(1)}s)`)

// Persistence across reload
await page.reload({ waitUntil: 'networkidle' })
await page.locator('.greenhouse-toggle').click()
await page.locator('.experiments-row .target-chip', { hasText: 'Songbook' }).click()
check(await page.locator('.songbook-open').isVisible(), 'saved song listed after reload')
check(/video linked/.test(await page.locator('.songbook-meta').innerText()), 'meta shows video linked')
await page.locator('.songbook-open').click()
check((await page.locator('.sheet-chord.now').innerText()) === 'G', 'reopened song starts at first chord')
check(/Standing on a beach/.test(await page.locator('.sheet').innerText()), 'sheet re-renders from stored rawTab')
check(/synced to video/.test(await page.locator('.sync-status').innerText()), 'sync map persists across reload')

// Delete flow
await page.getByRole('button', { name: '← Songbook' }).click()
await page.locator('.songbook-delete').click()
check((await page.locator('.songbook-open').count()) === 0, 'delete removes the song')

check(errors.length === 0, errors.length ? `page errors: ${errors.join('|')}` : 'no page errors')
await browser.close()
console.log(failures === 0 ? '\nALL SONGBOOK CHECKS PASSED' : `\n${failures} FAILED`)
process.exit(failures ? 1 : 0)
