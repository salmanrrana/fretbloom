// Browser flow uses known audio from a controlled API response; the separate
// live verification checks actual public YouTube retrieval through the server.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5201'
const rate = 24000
const notes = [64, 67, 69, 71]
const starts = [0.6, 1.8, 3, 4.2]
function wav({ silence = false, seconds = 5.6 } = {}) {
  const length = Math.ceil(seconds * rate)
  const buffer = Buffer.alloc(44 + length * 2)
  buffer.write('RIFF')
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(length * 2, 40)
  for (let i = 0; i < length; i++) {
    const time = i / rate
    const n = starts.findIndex((start) => time >= start && time < start + 0.95)
    if (silence || n < 0) continue
    const t = time - starts[n]
    const frequency = 440 * 2 ** ((notes[n] - 69) / 12)
    const envelope =
      Math.min(1, t / 0.015) *
      Math.exp(-t * 1.4) *
      Math.min(1, (0.95 - t) / 0.03)
    const signal =
      (Math.sin(2 * Math.PI * frequency * t) +
        0.24 * Math.sin(4 * Math.PI * frequency * t) +
        0.08 * Math.sin(6 * Math.PI * frequency * t)) *
      envelope *
      0.5
    buffer.writeInt16LE(Math.round(signal * 32767), 44 + i * 2)
  }
  return buffer
}
const recording = {
  name: 'known-guitar-phrase.wav',
  mimeType: 'audio/wav',
  buffer: wav(),
}
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.route('**/api/youtube-lyrics/*', (route) =>
  route.fulfill({
    json: { status: 'unavailable', cues: [], language: null, automatic: false },
  }),
)
await page.route('**/api/youtube-captions/*', (route) =>
  route.fulfill({
    json: { status: 'unavailable', cues: [], language: null, automatic: false },
  }),
)
let requests = 0
await page.route('**/api/youtube-audio/*', async (route) => {
  requests++
  const id = new URL(route.request().url()).pathname.split('/').at(-1)
  if (id === 'M7lc1UVf-VE')
    return route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'UNAVAILABLE',
          message: 'This YouTube video is unavailable.',
        },
      }),
    })
  if (id === 'YE7VzlLtp-4')
    await new Promise((resolve) => setTimeout(resolve, 1500))
  await route.fulfill({
    contentType: 'audio/wav',
    headers: { 'x-video-title': encodeURIComponent('Known YouTube phrase') },
    body: recording.buffer,
  })
})
await page.route('https://www.youtube-nocookie.com/embed/**', (route) =>
  route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><body style="background:#182010;color:white;font-family:sans-serif"><button id="play">Play test video</button><script>
let time=0,state=2,rate=1;
function report(){parent.postMessage({event:'infoDelivery',info:{currentTime:time,playerState:state,playbackRate:rate}},${JSON.stringify(new URL(base).origin)})}
window.addEventListener('message',e=>{let d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data}catch{return}
if(d.event==='command'){if(d.func==='seekTo'){time=d.args[0];document.body.dataset.seek=time}if(d.func==='playVideo')state=1;if(d.func==='pauseVideo')state=2}
if(d.event==='listening'||d.event==='command')report()});
document.querySelector('#play').onclick=()=>{state=1;report()};
setInterval(()=>{if(state===1)time+=.1*rate;report()},100)
</script></body>`,
  }),
)
try {
  await page.goto(base)
  await page.locator('.greenhouse-toggle').click()
  await page.getByRole('button', { name: 'Songbook', exact: true }).click()
  assert.equal(await page.locator('input[type=file]').count(), 0)
  await page
    .getByLabel('YouTube link', { exact: true })
    .fill('https://youtu.be/dQw4w9WgXcQ')
  await page
    .getByLabel('Paste tab')
    .fill(
      'e|--0---3---5---7--|\nB|----------------|\nG|----------------|\nD|----------------|\nA|----------------|\nE|----------------|',
    )
  await page.getByRole('button', { name: 'Open YouTube song' }).click()
  await page
    .getByText('synced to video', { exact: false })
    .waitFor({ timeout: 20000 })
  const song = await page.evaluate(
    () => JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))[0],
  )
  assert.equal(song.title, 'Known YouTube phrase')
  assert.deepEqual(
    song.videoAnalysis.notes.map((note) => note.midi),
    notes,
  )
  for (let i = 0; i < notes.length; i++)
    assert.ok(Math.abs(song.syncTimes[i] - starts[i]) < 0.35)
  console.log(
    'PASS URL-only import automatically retrieves audio, detects notes, and saves video timing',
  )
  await page.getByRole('button', { name: 'Original tab', exact: true }).click()
  await page.locator('.sheet [data-step="2"]').click()
  const video = page
    .frames()
    .find((frame) => frame.url().includes('youtube-nocookie.com'))
  assert.ok(video)
  await page.waitForTimeout(150)
  assert.ok(
    Math.abs(
      Number(await video.locator('body').getAttribute('data-seek')) -
        song.syncTimes[2],
    ) < 0.1,
  )
  await video.locator('#play').click()
  await page.waitForFunction(
    () =>
      document
        .querySelector('.sheet [data-step="3"]')
        ?.getAttribute('aria-current') === 'step',
  )
  console.log(
    'PASS iframe clock follows playback; tapping the sheet seeks the video',
  )
  await page.getByRole('button', { name: '← Songbook', exact: true }).click()
  const previousRequests = requests
  await page.locator('.songbook-open').click()
  await page.getByText('synced to video', { exact: false }).waitFor()
  await page.waitForTimeout(600)
  assert.equal(requests, previousRequests)
  console.log(
    'PASS saved video notes and timing reopen without another download',
  )
  // Restoring a previously analyzed sequence must restore its automatic map.
  const originalTab = song.rawTab
  await page.getByRole('button', { name: 'Edit Known YouTube phrase' }).click()
  await page.getByLabel('Paste tab').fill(originalTab.replace('7--', '9--'))
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('button', { name: 'Cancel analysis' }).click()
  await page.getByRole('button', { name: 'Edit Known YouTube phrase' }).click()
  await page.getByLabel('Paste tab').fill(originalTab)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByText('synced to video', { exact: false }).waitFor()
  const restored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))[0],
  )
  assert.deepEqual(restored.syncTimes, song.syncTimes)
  // Older manual maps must survive new automatic note analysis.
  const manualTimes = [0.4, 1.6, 2.8, 4]
  await page.evaluate((times) => {
    const songs = JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))
    songs[0].syncTimes = times
    songs[0].syncSource = 'manual'
    delete songs[0].videoAnalysis
    localStorage.setItem('fretbloom.songbook.v1', JSON.stringify(songs))
  }, manualTimes)
  await page.reload()
  await page.locator('.greenhouse-toggle').click()
  await page.getByRole('button', { name: 'Songbook', exact: true }).click()
  await page.locator('.songbook-open').click()
  await page
    .getByText('4 estimated notes', { exact: false })
    .waitFor({ timeout: 20000 })
  const preserved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))[0],
  )
  assert.deepEqual(preserved.syncTimes, manualTimes)
  assert.equal(preserved.syncSource, 'manual')
  console.log(
    'PASS canceled edits restore cached timing; automatic analysis preserves manual timing',
  )
  await page.screenshot({
    path: '/tmp/fretbloom-youtube-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  )
  await page.locator('.recording-panel').scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/fretbloom-youtube-mobile.png' })
  await page.getByRole('button', { name: 'Edit Known YouTube phrase' }).click()
  await page
    .getByLabel('YouTube link', { exact: true })
    .fill('https://youtu.be/M7lc1UVf-VE')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('alert').waitFor({ timeout: 20000 })
  assert.match(await page.getByRole('alert').innerText(), /unavailable/)
  const changed = await page.evaluate(
    () => JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))[0],
  )
  assert.equal(changed.syncTimes, undefined)
  assert.equal(changed.videoAnalysis, undefined)
  assert.equal(await page.locator('input[type=file]').count(), 0)
  console.log(
    'PASS changed video clears old analysis; unavailable video gives an honest error',
  )
  await page.getByRole('button', { name: 'Edit Known YouTube phrase' }).click()
  await page
    .getByLabel('YouTube link', { exact: true })
    .fill('https://youtu.be/YE7VzlLtp-4')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('button', { name: 'Cancel analysis' }).click()
  await page.getByText('Analysis canceled.', { exact: true }).waitFor()
  await page.waitForTimeout(1800)
  assert.equal(await page.locator('.recording-notes').count(), 0)
  console.log('PASS canceled analysis cannot write a late result')
  await page.getByRole('button', { name: '← Songbook', exact: true }).click()
  await page.locator('.setlist-add').click()
  await page
    .getByLabel('YouTube link', { exact: true })
    .fill('https://youtu.be/dQw4w9WgXcQ')
  await page.getByRole('button', { name: 'Open YouTube song' }).click()
  await page
    .getByText('4 estimated notes', { exact: false })
    .waitFor({ timeout: 20000 })
  assert.equal(await page.locator('.sheet').count(), 0)
  assert.ok(await page.locator('.video-frame').isVisible())
  assert.deepEqual(errors, [])
  console.log('PASS YouTube link alone works without a tab; no page errors')
} finally {
  await browser.close()
}
