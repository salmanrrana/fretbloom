import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5201'
const id = 'dQw4w9WgXcQ'
const notes = [0.5, 2, 3.5, 5, 8].map((start, index) => ({
  start,
  end: start + 0.5,
  midi: 60 + index,
  confidence: 0.9,
}))
const cues = [
  { start: 2, end: 3, text: 'Morning light' },
  { start: 5, end: 7, text: 'Carry me home' },
]
let servedCues = cues
const saved = {
  id: 'song-lyrics-test',
  title: 'Morning light',
  rawTab: '',
  steps: [],
  youtubeId: id,
  savedAt: Date.now(),
  videoAnalysis: {
    version: 3,
    videoId: id,
    sequenceKey: '[]',
    duration: 10,
    notes,
    chords: [],
    times: null,
    syncReason: 'No tab',
    transpose: 0,
  },
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
let captionRequests = 0
let available = true
let delayCaptions = false
await page.route('**/api/youtube-lyrics/*', (route) =>
  route.fulfill({
    json: { status: 'unavailable', cues: [], language: null, automatic: false },
  }),
)
await page.route('**/api/youtube-captions/*', async (route) => {
  captionRequests++
  if (delayCaptions) await new Promise((resolve) => setTimeout(resolve, 1000))
  await route
    .fulfill({
      json: {
        status: available ? 'available' : 'unavailable',
        cues: available ? servedCues : [],
        language: 'en',
        automatic: false,
      },
    })
    .catch(() => {})
})
await page.route('**/api/youtube-audio/*', (route) =>
  route.fulfill({
    status: 422,
    json: {
      error: { code: 'UNAVAILABLE', message: 'Fixture has no new audio.' },
    },
  }),
)
await page.route('https://www.youtube-nocookie.com/embed/**', (route) =>
  route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><body style="background:#182010;color:#f4eedf;font:18px sans-serif;padding:24px">Controlled video fixture<script>
let time=0,state=2;function report(){parent.postMessage({event:'infoDelivery',info:{currentTime:time,playerState:state,playbackRate:1}},${JSON.stringify(new URL(base).origin)})}
window.setTime=(value,playing=false)=>{time=value;state=playing?1:2;report()};
window.addEventListener('message',e=>{let d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data}catch{return}if(d.event==='command'){if(d.func==='seekTo'){time=d.args[0];document.body.dataset.seek=time}if(d.func==='playVideo')state=1;if(d.func==='pauseVideo')state=2}report()});setInterval(report,100);
</script></body>`,
  }),
)
const readSong = () =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))[0],
  )
async function waitSaved(test) {
  await page.waitForFunction(test)
}
try {
  await page.goto(base)
  await page.evaluate(
    (song) =>
      localStorage.setItem('fretbloom.songbook.v1', JSON.stringify([song])),
    saved,
  )
  await page.getByRole('link', { name: 'Songbook', exact: true }).click()
  await page.waitForURL('**/songbook')
  await page.locator('.songbook-open').click()
  await page.locator('.lyric-row').first().waitFor()
  assert.equal(
    await page
      .getByRole('button', { name: 'Use lyrics from your sheet', exact: true })
      .count(),
    0,
  )
  assert.equal(await page.locator('.lyric-row').count(), 5)
  assert.equal(await page.locator('.lyric-notes button').count(), notes.length)
  assert.equal(
    await page
      .locator('.lyric-row')
      .nth(1)
      .locator('.lyric-notes button')
      .innerText(),
    'C#4',
  )
  assert.equal((await readSong()).lyrics.source, 'captions')
  const video = page
    .frames()
    .find((frame) => frame.url().includes('youtube-nocookie'))
  assert.ok(video)
  await page.getByRole('button', { name: 'C#4 at 0:02', exact: true }).click()
  // The seek reaches the player as a cross-frame message; wait for it.
  await video.locator('body[data-seek="2"]').waitFor()
  await video.evaluate(() => window.setTime(5.1))
  await page.waitForFunction(() =>
    document
      .querySelector('.lyric-row.active .lyric-words')
      ?.textContent.includes('Carry me home'),
  )
  console.log(
    'PASS captions join notes by line, retain instrumental notes, seek and highlight',
  )
  await page.getByRole('button', { name: 'Edit lyrics', exact: true }).click()
  await page.getByRole('button', { name: 'Save lyrics', exact: true }).click()
  assert.deepEqual((await readSong()).lyrics.cues, cues)
  console.log('PASS editing and saving unchanged lyrics preserves timing')
  await page.getByRole('button', { name: '← Songbook', exact: true }).click()
  const count = captionRequests
  await page.locator('.songbook-open').click()
  await page.locator('.lyric-row').first().waitFor()
  await page.waitForTimeout(500)
  assert.equal(captionRequests, count)
  if (process.env.CAPTURE)
    await page.screenshot({
      path: '/tmp/fretbloom-lyrics-desktop.png',
      fullPage: true,
    })
  await page.setViewportSize({ width: 390, height: 844 })
  if (process.env.CAPTURE)
    await page.screenshot({
      path: '/tmp/fretbloom-lyrics-mobile.png',
      fullPage: true,
    })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  )
  console.log(
    'PASS lyrics persist without another fetch; mobile has no horizontal overflow',
  )
  await page.setViewportSize({ width: 1280, height: 1000 })
  available = false
  await page
    .getByRole('button', { name: 'Find lyrics again', exact: true })
    .click()
  await page
    .getByText('No timed lyrics or captions were found', { exact: false })
    .waitFor()
  assert.deepEqual((await readSong()).lyrics.cues, cues)
  await page.getByRole('button', { name: 'Edit lyrics', exact: true }).click()
  await page
    .locator('#song-lyrics')
    .fill('[00:01]First phrase\n[00:04]\n[00:06]Last phrase')
  await page.getByRole('button', { name: 'Save lyrics', exact: true }).click()
  assert.deepEqual((await readSong()).lyrics.cues, [
    { start: 1, end: 4, text: 'First phrase' },
    { start: 6, end: 10, text: 'Last phrase' },
  ])
  console.log(
    'PASS unavailable replacement preserves lyrics; timed lyrics keep instrumental breaks',
  )
  await page.getByRole('button', { name: 'Edit lyrics', exact: true }).click()
  await page.locator('#song-lyrics').fill('First\nSecond\nThird')
  await page.getByRole('button', { name: 'Save lyrics', exact: true }).click()
  assert.equal((await readSong()).lyrics.cues, null)
  available = true
  delayCaptions = true
  const requestsBeforeTiming = captionRequests
  await page
    .getByRole('button', { name: 'Find lyrics again', exact: true })
    .click()
  while (captionRequests === requestsBeforeTiming) await page.waitForTimeout(20)
  await page
    .getByRole('button', { name: 'Time lyrics to song', exact: true })
    .click()
  const reopenedVideo = page
    .frames()
    .find((frame) => frame.url().includes('youtube-nocookie'))
  await reopenedVideo.waitForFunction(() => document.body.dataset.seek === '0')
  await page.waitForTimeout(150)
  for (let i = 0; i < 3; i++) {
    await reopenedVideo.evaluate(
      (time) => window.setTime(time, true),
      1 + i * 3,
    )
    await page.waitForTimeout(150)
    await page
      .getByRole('button', { name: `Mark line ${i + 1} of 3`, exact: true })
      .click()
  }
  await waitSaved(
    () =>
      JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))[0].lyrics.cues
        ?.length === 3,
  )
  for (const [i, cue] of (await readSong()).lyrics.cues.entries())
    assert.ok(
      Math.abs(cue.start - (1 + i * 3)) < 0.3,
      `line ${i}: ${cue.start}`,
    )
  await page.waitForTimeout(1200)
  assert.equal((await readSong()).lyrics.text, 'First\nSecond\nThird')
  assert.equal((await readSong()).lyrics.cues.length, 3)
  console.log(
    'PASS manual timing cancels pending lyrics retrieval and preserves completed marks',
  )
  available = true
  delayCaptions = true
  await page
    .getByRole('button', { name: 'Find lyrics again', exact: true })
    .click()
  await page
    .getByText('Finding lyrics for this recording…', { exact: true })
    .waitFor()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Edit lyrics', exact: true }).click()
  await page.locator('#song-lyrics').fill('[00:01]Keep my words')
  await page.getByRole('button', { name: 'Save lyrics', exact: true }).click()
  await page.waitForTimeout(1200)
  assert.equal((await readSong()).lyrics.text, '[00:01]Keep my words')
  console.log('PASS a late caption response cannot overwrite pasted lyrics')
  await page
    .getByRole('button', { name: 'Edit Morning light', exact: true })
    .click()
  await page
    .getByLabel('YouTube link', { exact: true })
    .fill('https://youtu.be/M7lc1UVf-VE')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  const changed = await readSong()
  assert.equal(changed.lyrics, undefined)
  assert.equal(changed.videoAnalysis, undefined)

  // A held A crosses two lyric boundaries; the sheet's words remain available
  // after imperfect automatic captions have been saved.
  servedCues = [
    { start: 2, end: 4, text: 'Paper bits' },
    { start: 4, end: 7, text: 'Under a room' },
    { start: 7, end: 10, text: 'Morning returns' },
  ]
  delayCaptions = false
  const chordSong = {
    ...saved,
    id: 'song-lyrics-held-chord',
    rawTab: '[A]Paper boats drift\n[A]Under the moon\n[D]Morning returns',
    videoAnalysis: {
      ...saved.videoAnalysis,
      notes: [],
      chords: [
        { label: 'A', start: 0.5, end: 6, confidence: 0.9 },
        { label: 'D', start: 6, end: 10, confidence: 0.9 },
      ],
    },
  }
  await page.evaluate(async (song) => {
    const { parseTab, stepMidiNotes } = await import('/src/data/tabParser.ts')
    const steps = parseTab(song.rawTab).steps
    song.steps = steps
    song.videoAnalysis.sequenceKey = JSON.stringify(
      steps.map((step) => [step.kind ?? 'chord', stepMidiNotes(step)]),
    )
    localStorage.setItem('fretbloom.songbook.v1', JSON.stringify([song]))
  }, chordSong)
  await page.reload()
  assert.equal(new URL(page.url()).pathname, '/songbook')
  await page.locator('.songbook-open').click()
  await page
    .getByRole('button', { name: 'Lyrics & notes', exact: true })
    .click()
  await page.locator('.lyric-row').first().waitFor()
  const chordVideo = page
    .frames()
    .find((frame) => frame.url().includes('youtube-nocookie'))
  assert.ok(chordVideo)
  await chordVideo.evaluate(() => window.setTime(5.4, true))
  await page.waitForFunction(() =>
    document
      .querySelector('.lyric-row.active .lyric-words')
      ?.textContent.includes('Under a room'),
  )
  await chordVideo.evaluate(() => window.setTime(5.4, false))
  assert.equal(await page.locator('.lyric-notes button.sounding').count(), 1)
  const activeHeld = page.locator(
    '.lyric-row.active .lyric-notes button.sounding.continuation',
  )
  assert.equal(await activeHeld.count(), 1)
  assert.match(await activeHeld.innerText(), /A.*held/)
  await activeHeld.click()
  await chordVideo.locator('body[data-seek="4"]').waitFor()
  await chordVideo.evaluate(() => window.setTime(6.5, false))
  await page.waitForFunction(() =>
    document
      .querySelector('.lyric-row.active .lyric-notes button.sounding')
      ?.textContent.includes('D'),
  )
  assert.equal(await page.locator('.lyric-notes button.sounding').count(), 1)
  console.log(
    'PASS held chord has one current occurrence; continuation seeks to its line; new chord replaces it',
  )

  await page.getByRole('button', { name: 'Edit lyrics', exact: true }).click()
  await page
    .locator('#song-lyrics')
    .fill('Paper ships\nUnder a room\nMorning returns')
  await page.getByRole('button', { name: 'Save lyrics', exact: true }).click()
  assert.equal((await readSong()).lyrics.source, 'pasted')
  await page
    .getByRole('button', { name: 'Use lyrics from your sheet', exact: true })
    .click()
  assert.equal(
    await page.locator('#song-lyrics').inputValue(),
    'Paper boats drift\nUnder the moon\nMorning returns',
  )
  assert.equal(
    (await readSong()).lyrics.text,
    'Paper ships\nUnder a room\nMorning returns',
  )
  await page.getByRole('button', { name: 'Save lyrics', exact: true }).click()
  assert.equal(
    (await readSong()).lyrics.text,
    'Paper boats drift\nUnder the moon\nMorning returns',
  )
  assert.equal((await readSong()).lyrics.cues, null)
  assert.equal((await readSong()).lyrics.source, 'pasted')
  await page
    .getByRole('button', { name: 'Time lyrics to song', exact: true })
    .waitFor()
  console.log(
    'PASS sheet words can replace bad captions without borrowing their timestamps',
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS changing the video clears its old lyrics and note analysis; no browser errors',
  )
} finally {
  await browser.close()
}
