// Songbook flow: paste a tab + YouTube link, save, follow along, persistence.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
let failures = 0
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
check((await page.locator('.mode-btn').count()) === 4, 'four mode buttons now')

await page.getByRole('button', { name: 'Songbook' }).click()
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
check(await page.locator('.chord-card.now').isVisible(), 'saving opens the player')
check((await page.locator('.video-frame iframe').count()) === 1, 'youtube iframe embedded')
const src = await page.locator('.video-frame iframe').getAttribute('src')
check(src.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'), 'privacy-enhanced embed URL')

const first = await page.locator('.chord-card.now .chord-name').innerText()
check(first === 'G', `first chord is G (got ${first})`)
check(/Intro/i.test(await page.locator('.chord-card.now .role').innerText()), 'section label shown')

// Advance via button
await page.getByRole('button', { name: 'next chord →' }).click()
check((await page.locator('.chord-card.now .chord-name').innerText()) === 'D', 'next button advances G -> D')

// Advance via keyboard
await page.keyboard.press('ArrowRight')
check((await page.locator('.chord-card.now .chord-name').innerText()) === 'Am', 'ArrowRight advances D -> Am')
await page.keyboard.press('ArrowLeft')
check((await page.locator('.chord-card.now .chord-name').innerText()) === 'D', 'ArrowLeft goes back')

// Jump via timeline to F#m — a generated barre shape
await page.locator('.timeline-jump', { hasText: /^F#m$/ }).click()
check((await page.locator('.chord-card.now .chord-name').innerText()) === 'F#m', 'timeline jump to F#m')
check(await page.locator('.chord-card.now .diagram').isVisible(), 'barre chord renders a diagram')
const tabText = await page.locator('.chord-card.now .tab-block').innerText()
check(/2/.test(tabText) && /4/.test(tabText), `F#m tab shows barre frets (${tabText.replace(/\n/g, ' ')})`)

// Persistence across reload
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Songbook' }).click()
check(await page.locator('.songbook-open').isVisible(), 'saved song listed after reload')
check(/video linked/.test(await page.locator('.songbook-meta').innerText()), 'meta shows video linked')
await page.locator('.songbook-open').click()
check((await page.locator('.chord-card.now .chord-name').innerText()) === 'G', 'reopened song starts at first chord')

// Delete flow
await page.getByRole('button', { name: '← Songbook' }).click()
await page.locator('.songbook-delete').click()
check((await page.locator('.songbook-open').count()) === 0, 'delete removes the song')

check(errors.length === 0, errors.length ? `page errors: ${errors.join('|')}` : 'no page errors')
await browser.close()
console.log(failures === 0 ? '\nALL SONGBOOK CHECKS PASSED' : `\n${failures} FAILED`)
process.exit(failures ? 1 : 0)
