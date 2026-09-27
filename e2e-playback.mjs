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
  id: 'song-playback-test',
  title: 'Playback fixture',
  youtubeId: videoId,
  rawTab: '',
  steps: [],
  savedAt: Date.now(),
  videoAnalysis: {
    version: 3,
    videoId,
    sequenceKey: '[]',
    duration,
    endTime: null,
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

async function installMicFixture() {
  await page.evaluate(async () => {
    const { engine } = await import('/src/audio/engine.ts')
    const mic = engine.mic
    const probe = { active: false, starts: 0, stops: 0, midis: [] }
    const sampleRate = engine.ctx.sampleRate
    mic.start = async () => {
      probe.active = true
      probe.starts++
    }
    mic.stop = () => {
      probe.active = false
      probe.stops++
    }
    mic.frame = () => {
      if (!probe.active || !probe.midis.length) return null
      const frame = new Float32Array(4096)
      for (let i = 0; i < frame.length; i++) {
        for (const midi of probe.midis) {
          frame[i] +=
            (0.18 / probe.midis.length) *
            Math.sin(
              (2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * i) / sampleRate,
            )
        }
      }
      return frame
    }
    window.micProbe = probe
  })
}

await page.route('**/api/**', (route) => {
  const path = new URL(route.request().url()).pathname
  if (path === '/api/songs')
    return route.fulfill({ status: 404, body: 'No local song database' })
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
  await page.getByRole('link', { name: 'Songbook', exact: true }).click()
  await page.waitForURL('**/songbook')
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
  assert.equal(new URL(page.url()).pathname, '/songbook')
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
  silentEmbed = false
  // A pasted, synced sheet exercises fractional media seeks and the actual
  // before/after states of a chord rather than just its displayed shape.
  await page.getByRole('button', { name: '← Songbook', exact: true }).click()
  await page.evaluate(async () => {
    const { parseTab, stepMidiNotes } = await import('/src/data/tabParser.ts')
    const songs = JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))
    songs[0].youtubeId = '3VoWqGhLvF8'
    songs[0].videoAnalysis.videoId = '3VoWqGhLvF8'
    songs[0].lyrics.videoId = '3VoWqGhLvF8'
    songs[0].rawTab = 'D F#m D'
    songs[0].syncTimes = [0.683, 4, 7.12345678]
    songs[0].syncSource = 'manual'
    songs[0].videoAnalysis.chords = [
      { label: 'D', start: 7.12345678, end: 10 },
      { label: 'N', start: 10, end: 12 },
    ]
    songs[0].videoAnalysis.sequenceKey = JSON.stringify(
      parseTab(songs[0].rawTab).steps.map((step) => [
        step.kind ?? 'chord',
        stepMidiNotes(step),
      ]),
    )
    localStorage.setItem('fretbloom.songbook.v1', JSON.stringify(songs))
  })
  await page.reload()
  assert.equal(new URL(page.url()).pathname, '/songbook')
  await page.locator('.songbook-open').click()
  await page.waitForFunction(
    () => document.querySelector('audio')?.readyState >= 3,
  )
  assert.equal(
    await page.locator('.chord-card .role').first().textContent(),
    'Get ready',
  )
  assert.equal(await page.locator('.sheet-chord.now').count(), 0)
  await page.locator('.sheet-chord[data-step="2"]').click()
  await page.waitForFunction(
    () => document.querySelector('audio')?.currentTime > 7,
  )
  await page.waitForFunction(
    () =>
      document.querySelector('.sheet-chord.now')?.getAttribute('data-step') ===
      '2',
  )
  assert.equal(await page.locator('.sheet-chord.now').count(), 1)
  assert.equal(
    await page.locator('.chord-card .role').first().textContent(),
    'Now',
  )
  await page.locator('audio').evaluate((audio) => {
    audio.currentTime = 3.98
  })
  await page.waitForFunction(
    () =>
      document.querySelector('.sheet-chord.now')?.getAttribute('data-step') ===
      '0',
  )
  await page.evaluate(() => {
    window.chordGaps = 0
    window.chordObserver = new MutationObserver(() => {
      if (!document.querySelector('.sheet-chord.now')) window.chordGaps++
    })
    window.chordObserver.observe(document.querySelector('.sheet'), {
      attributes: true,
      subtree: true,
      attributeFilter: ['class'],
    })
  })
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await page.waitForFunction(
    () =>
      document.querySelector('.sheet-chord.now')?.getAttribute('data-step') ===
      '1',
  )
  await page.getByRole('button', { name: 'Pause song', exact: true }).click()
  assert.equal(
    await page.evaluate(() => {
      window.chordObserver.disconnect()
      return window.chordGaps
    }),
    0,
    'a chord change must not briefly clear the current chord',
  )
  assert.equal(await page.locator('.sheet-chord.now').count(), 1)
  await page.locator('audio').evaluate((audio) => {
    audio.currentTime = 10.5
  })
  await page.waitForFunction(
    () =>
      document.querySelector('.chord-card .role')?.textContent ===
      'No chord now',
  )
  assert.equal(await page.locator('.sheet-chord.now').count(), 0)
  await page.locator('audio').evaluate((audio) => {
    audio.currentTime = audio.duration
  })
  await page.waitForFunction(
    () =>
      document.querySelector('.chord-card .role')?.textContent === 'Finished',
  )
  assert.equal(await page.locator('.sheet-chord.now').count(), 0)
  console.log(
    'PASS synced sheet selects a fractional chord, crosses one boundary, and clears Now at the end',
  )

  await page.locator('audio').evaluate((audio) => {
    audio.currentTime = 1
  })
  await page.waitForFunction(
    () =>
      document.querySelector('.sheet-chord.now')?.getAttribute('data-step') ===
      '0',
  )
  await installMicFixture()
  await page.evaluate(async () => {
    const { parseTab, stepMidiNotes } = await import('/src/data/tabParser.ts')
    window.micProbe.midis = stepMidiNotes(parseTab('D F#m D').steps[0])
  })
  await page
    .getByRole('button', { name: 'Listen to me play', exact: true })
    .click()
  await page.waitForFunction(() => window.micProbe.active)
  await page.waitForFunction(() =>
    document
      .querySelector('.songbook-listen-status')
      ?.textContent?.includes('Play F#m'),
  )
  await page.waitForFunction(
    () =>
      document.querySelector('.sheet-chord.now')?.getAttribute('data-step') ===
      '1',
  )
  assert.equal(await page.locator('.chord-card .role').textContent(), 'Now')
  assert.equal(
    await page.locator('.chord-card.now .chord-name').textContent(),
    'F#m',
  )
  assert.equal(
    await page.locator('audio').evaluate((audio) => audio.paused),
    true,
  )
  await page
    .getByRole('button', { name: 'Stop listening', exact: true })
    .click()
  assert.equal(await page.evaluate(() => window.micProbe.active), false)
  console.log(
    'PASS mic follow keeps the advanced synced chord current while playback is paused',
  )

  // Older saves may keep manual sheet timing after their analysis is gone.
  await page.getByRole('button', { name: '← Songbook', exact: true }).click()
  await page.evaluate(() => {
    const songs = JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))
    sessionStorage.setItem(
      'playbackFixtureAnalysis',
      JSON.stringify(songs[0].videoAnalysis),
    )
    songs[0].videoAnalysis = null
    localStorage.setItem('fretbloom.songbook.v1', JSON.stringify(songs))
  })
  await page.reload()
  await page.locator('.songbook-open').click()
  await page.waitForFunction(
    () => document.querySelector('audio')?.readyState >= 3,
  )
  await page.locator('audio').evaluate((audio) => {
    audio.currentTime = 8
  })
  await page.waitForFunction(
    () =>
      document.querySelector('.sheet-chord.now')?.getAttribute('data-step') ===
      '2',
  )
  await page.locator('audio').evaluate((audio) => {
    audio.currentTime = audio.duration
  })
  await page.waitForFunction(() => document.querySelector('audio')?.ended)
  await page.waitForFunction(
    () =>
      document.querySelector('.chord-card .role')?.textContent === 'Finished',
    null,
    { timeout: 2000 },
  )
  assert.equal(
    await page.locator('.chord-card .role').textContent(),
    'Finished',
  )
  assert.equal(await page.locator('.sheet-chord.now').count(), 0)
  console.log('PASS manual sync finishes at the media end without analysis')

  // An analyzed song with no trustworthy timing remains a manual practice
  // sheet. A numbered tab still offers its playable fret shape on a phone.
  await page.getByRole('button', { name: '← Songbook', exact: true }).click()
  await page.evaluate(async () => {
    const { parseTab, stepMidiNotes } = await import('/src/data/tabParser.ts')
    const songs = JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))
    songs[0].rawTab =
      'e|--0--3--|\nB|--------|\nG|--------|\nD|--------|\nA|--------|\nE|--------|'
    songs[0].syncTimes = null
    songs[0].syncSource = null
    songs[0].videoAnalysis = JSON.parse(
      sessionStorage.getItem('playbackFixtureAnalysis'),
    )
    songs[0].videoAnalysis.sequenceKey = JSON.stringify(
      parseTab(songs[0].rawTab).steps.map((step) => [
        step.kind ?? 'chord',
        stepMidiNotes(step),
      ]),
    )
    localStorage.setItem('fretbloom.songbook.v1', JSON.stringify(songs))
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  assert.equal(new URL(page.url()).pathname, '/songbook')
  await page.locator('.songbook-open').click()
  await page.waitForFunction(
    () => document.querySelector('audio')?.readyState >= 3,
  )
  assert.equal(
    await page.locator('.chord-card .role').first().textContent(),
    'Selected chord',
  )
  assert.equal(await page.locator('.sheet-chord.now').count(), 0)
  assert.equal(
    await page.locator('.chord-card.note-step .tab-block').isVisible(),
    true,
  )
  await page.locator('.sheet-chord[data-step="1"]').click()
  await page.waitForFunction(
    () =>
      document
        .querySelector('.sheet-chord.selected')
        ?.getAttribute('data-step') === '1',
  )
  console.log(
    'PASS unsynced numbered tab remains a selected practice step with visible fingering on mobile',
  )
  await installMicFixture()
  await page
    .getByRole('button', { name: 'Listen to me play', exact: true })
    .click()
  await page.waitForFunction(() => window.micProbe.active)
  await page
    .getByRole('button', { name: 'Lyrics & notes', exact: true })
    .click()
  await page.waitForFunction(() => !window.micProbe.active)
  assert.equal(await page.evaluate(() => window.micProbe.stops), 1)
  await page.locator('audio').evaluate((audio) => {
    audio.currentTime = 8
  })
  await page.waitForFunction(
    () =>
      document.querySelector('.chord-card .role')?.textContent === 'Heard now',
  )
  assert.equal(await page.locator('.chord-card').count(), 1)
  assert.equal(await page.locator('.recording-now').count(), 0)
  assert.equal(await page.locator('.chord-card .chord-name').innerText(), 'D')
  await page.getByRole('button', { name: 'Chord sheet', exact: true }).click()
  assert.equal(
    await page.locator('.chord-card .role').textContent(),
    'Selected chord',
  )
  assert.equal(
    await page.locator('.sheet-chord.selected').getAttribute('data-step'),
    '1',
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS lyrics follow the audio estimate while the untimed sheet keeps its separate practice selection',
  )
} finally {
  await browser.close()
}
