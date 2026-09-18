import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5201'
const videoId = '3VoWqGhLvF8'
const duration = 12
const sampleRate = 12_000

// A complete silent PCM recording exercises the browser's real media clock.
const wav = Buffer.alloc(44 + sampleRate * duration * 2)
wav.write('RIFF', 0)
wav.writeUInt32LE(wav.length - 8, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(sampleRate, 24)
wav.writeUInt32LE(sampleRate * 2, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(wav.length - 44, 40)

const song = {
  id: 'playback-test',
  title: 'Playback fixture',
  youtubeId: videoId,
  rawTab: '',
  steps: [],
  savedAt: Date.now(),
  videoAnalysis: {
    videoId,
    sequenceKey: '[]',
    duration,
    notes: [{ start: 7, end: 8, midi: 64, confidence: 0.9 }],
    chords: [],
    times: null,
    syncReason: null,
    transpose: 0,
  },
  lyrics: {
    videoId,
    source: 'pasted',
    automatic: false,
    language: null,
    text: 'First phrase\nSecond phrase',
    cues: [
      { start: 0, end: 6, text: 'First phrase' },
      { start: 6, end: duration, text: 'Second phrase' },
    ],
  },
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
page.setDefaultTimeout(10_000)
const errors = []
const unexpectedRequests = []
let audioRequests = 0
let unavailable = false
let silentEmbed = false
page.on('pageerror', (error) => errors.push(error.message))

await page.route('**/api/**', (route) => {
  const path = new URL(route.request().url()).pathname
  if (!/^\/api\/youtube-audio\/(?:3VoWqGhLvF8|silentEmbed)$/.test(path)) {
    unexpectedRequests.push(path)
    return route.fulfill({ status: 500, body: 'Unexpected fixture request' })
  }
  audioRequests++
  return unavailable
    ? route.fulfill({
        status: 422,
        json: { error: { message: 'Fixture audio is unavailable.' } },
      })
    : route.fulfill({ contentType: 'audio/wav', body: wav })
})
await page.route('https://www.youtube-nocookie.com/embed/**', (route) =>
  route.fulfill({
    contentType: 'text/html',
    body: silentEmbed
      ? '<!doctype html><body>Silent video fixture</body>'
      : `<!doctype html><body>Blocked video fixture<script>
window.addEventListener('message', event => {
  let data;
  try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; }
  catch { return; }
  if (data.event === 'listening') {
    parent.postMessage({ event: 'onError', info: 150 }, ${JSON.stringify(new URL(base).origin)});
  }
});
</script></body>`,
  }),
)

try {
  await page.goto(base)
  await page.evaluate(
    (saved) =>
      localStorage.setItem('fretbloom.songbook.v1', JSON.stringify([saved])),
    song,
  )
  await page.locator('.greenhouse-toggle').click()
  await page.getByRole('button', { name: 'Songbook', exact: true }).click()
  await page.locator('.songbook-open').click()

  await page.waitForFunction(
    () => document.querySelector('audio')?.readyState >= 3,
  )
  assert.equal(audioRequests, 1)
  assert.equal(await page.locator('.video-frame').isVisible(), false)
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await page.waitForFunction(
    () => document.querySelector('audio')?.currentTime > 0.3,
  )
  await page.getByLabel('Playback speed', { exact: true }).selectOption('0.75')
  assert.equal(
    await page.locator('audio').evaluate((audio) => audio.playbackRate),
    0.75,
  )

  // Native range keyboard input checks the transport; the note checks lyric seeking.
  await page.getByLabel('Song position', { exact: true }).press('Home')
  await page.waitForFunction(
    () => document.querySelector('audio')?.currentTime < 0.2,
  )
  await page.getByRole('button', { name: 'E4 at 0:07', exact: true }).click()
  await page.waitForFunction(() => {
    const audio = document.querySelector('audio')
    return audio && audio.currentTime >= 7 && audio.currentTime < 8
  })
  await page.waitForFunction(() =>
    document
      .querySelector('.lyric-row.active')
      ?.textContent.includes('Second phrase'),
  )
  await page.getByRole('button', { name: 'Pause song', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('audio')?.paused)
  assert.equal(audioRequests, 1)
  console.log(
    'PASS embed 150 restores cold-cache audio; play, seek, speed and lyrics share its clock',
  )

  unavailable = true
  await page.getByRole('button', { name: '← Songbook', exact: true }).click()
  await page.locator('.songbook-open').click()
  await page
    .getByRole('alert')
    .filter({ hasText: 'Fixture audio is unavailable.' })
    .waitFor()
  assert.equal(audioRequests, 2)
  assert.equal(
    await page
      .getByRole('button', { name: 'Play song', exact: true })
      .isDisabled(),
    true,
  )
  assert.equal(
    await page
      .getByRole('button', { name: 'Retry song playback', exact: true })
      .isVisible(),
    true,
  )
  assert.deepEqual(unexpectedRequests, [])
  assert.deepEqual(errors, [])
  console.log(
    'PASS unavailable fallback audio shows a retry without pretending playback is ready',
  )

  // A player that never reports anything (blocked embed behind an extension)
  // must not leave the transport disabled: the song audio takes over.
  unavailable = false
  silentEmbed = true
  await page.getByRole('button', { name: '← Songbook', exact: true }).click()
  await page.evaluate(() => {
    const songs = JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))
    songs[0].youtubeId = 'silentEmbed'
    songs[0].videoAnalysis.videoId = 'silentEmbed'
    songs[0].lyrics.videoId = 'silentEmbed'
    localStorage.setItem('fretbloom.songbook.v1', JSON.stringify(songs))
  })
  await page.reload()
  await page.locator('.greenhouse-toggle').click()
  await page.getByRole('button', { name: 'Songbook', exact: true }).click()
  await page.locator('.songbook-open').click()
  await page.locator('.video-frame').waitFor({ state: 'visible' })
  assert.equal(
    await page
      .getByRole('button', { name: 'Play song', exact: true })
      .isDisabled(),
    true,
  )
  await page
    .getByText('The video player didn’t start', { exact: false })
    .waitFor({ timeout: 15_000 })
  await page.waitForFunction(
    () => document.querySelector('audio')?.readyState >= 3,
  )
  assert.equal(await page.locator('.video-frame').isVisible(), false)
  assert.equal(
    await page
      .getByRole('button', { name: 'Play song', exact: true })
      .isDisabled(),
    false,
  )
  assert.deepEqual(errors, [])
  console.log('PASS a silent embedded player falls back to the song audio')
} finally {
  await browser.close()
}
