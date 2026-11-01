// Development-only synthesized input. No network media, mocks, or evaluation corpus.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5202'
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname))
  throw new Error('This test only runs against a local app.')
const rate = 24000,
  seconds = 5
function recording(shift = 0) {
  const wav = Buffer.alloc(44 + rate * seconds * 2)
  wav.write('RIFF')
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(wav.length - 44, 40)
  for (let i = 0; i < rate * seconds; i++) {
    const time = i / rate
    if (time < 0.4 || time >= 4) continue
    const midis = time < 2.6 ? [48, 52, 55, 60] : [64]
    let sample = 0
    for (const midi of midis) {
      const hz = 440 * 2 ** ((midi + shift - 69) / 12)
      sample +=
        (Math.sin(2 * Math.PI * hz * time) +
          0.2 * Math.sin(4 * Math.PI * hz * time)) *
        0.1
    }
    sample *= Math.min(1, (time - 0.4) / 0.03, (4 - time) / 0.03)
    wav.writeInt16LE(Math.round(sample * 32767), 44 + i * 2)
  }
  return { name: 'development-phrase.wav', mimeType: 'audio/wav', buffer: wav }
}
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const readSaved = () =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('fretbloom.songbook.v1') ?? '[]')[0],
  )
async function settled(hash, revision = 0) {
  await page.waitForFunction(
    ({ oldHash, previousRevision }) => {
      const song = JSON.parse(
        localStorage.getItem('fretbloom.songbook.v1') ?? '[]',
      )[0]
      return (
        song?.audioAnalysis &&
        song.revision > previousRevision &&
        (!oldHash || song.audioAnalysis.pcmSha256 !== oldHash)
      )
    },
    { oldHash: hash, previousRevision: revision },
    { timeout: 180_000 },
  )
  await page
    .getByRole('button', { name: 'Analyze recording again', exact: true })
    .waitFor({ timeout: 180_000 })
}
try {
  const capabilities = await page.request.get(
    `${base}/api/analysis/v1/capabilities`,
  )
  assert.equal(
    capabilities.status(),
    200,
    'Run npm run dev:full or start:full before this test',
  )
  assert.equal((await capabilities.json()).schemaVersion, 1)
  await page.goto(`${base}/songbook`)
  await page
    .getByLabel('Song title', { exact: true })
    .fill('Rust development phrase')
  await page.getByLabel('Paste tab', { exact: true }).fill('C')
  await page
    .getByLabel('Upload recording', { exact: true })
    .setInputFiles(recording())
  const started = performance.now()
  await page.getByRole('button', { name: 'Save song', exact: true }).click()
  await settled()
  const song = await readSaved()
  assert.equal(song.youtubeId, null)
  assert.equal(song.audioAnalysis.source.kind, 'upload')
  assert.equal(song.audioAnalysis.analysis.duration, seconds)
  assert.equal(song.uploadSource.pcmSha256, song.audioAnalysis.pcmSha256)
  const analysisMs = Math.round(performance.now() - started)
  const json = JSON.stringify(song)
  for (const key of ['jobId', 'frames', 'blob:', 'audioUrl'])
    assert.ok(!json.includes(`"${key}"`), `No ephemeral ${key} in persistence`)
  assert.equal(
    await page.locator('iframe').count(),
    0,
    'Uploads must never create a YouTube iframe',
  )
  const audio = page.locator('audio')
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await page.waitForFunction(
    () => document.querySelector('audio')?.currentTime > 0.1,
  )
  await page.getByRole('button', { name: 'Pause song', exact: true }).click()
  await page.getByLabel('Song position', { exact: true }).fill('4.5')
  await page.waitForFunction(() =>
    document
      .querySelector('.audio-analysis .recording-now')
      ?.textContent?.includes('silence'),
  )
  assert.ok(
    await audio.evaluate(
      (element) => Math.abs(element.currentTime - 4.5) < 0.11,
    ),
  )
  await page
    .getByRole('button', { name: 'Set timing manually', exact: true })
    .click()
  await page.waitForFunction(
    () => document.querySelector('audio')?.currentTime > 0.1,
  )
  await page.getByRole('button', { name: 'C now', exact: true }).click()
  const manual = await readSaved()
  assert.equal(manual.syncSource, 'manual')
  assert.equal(manual.syncTimes.length, 1)
  await page
    .getByRole('button', { name: 'Lyrics & notes', exact: true })
    .click()
  await page
    .locator('#upload-lyrics')
    .fill('[00:00.40]First line\n[00:02.60]Second line')
  await page.getByRole('button', { name: 'Save lyrics', exact: true }).click()
  await page.getByLabel('Song position', { exact: true }).fill('1.5')
  await page.waitForFunction(() =>
    document
      .querySelector('.lyric-row[aria-current="true"]')
      ?.textContent?.includes('First line'),
  )
  assert.equal(await page.locator('.lyric-row[aria-current="true"]').count(), 1)
  assert.equal(
    await page
      .locator('.lyric-words')
      .first()
      .evaluate((button) => getComputedStyle(button).backgroundColor),
    'rgba(0, 0, 0, 0)',
  )

  await mkdir('test-results', { recursive: true })
  if (process.env.SCREENSHOTS !== '0')
    await page.screenshot({
      path: 'test-results/rust-analysis-desktop.png',
      fullPage: true,
    })
  await page.reload()
  await page
    .locator('.songbook-open')
    .filter({ hasText: 'Rust development phrase' })
    .click()
  await page
    .getByText(
      'Reattach your recording below to verify and restore playback.',
      { exact: true },
    )
    .waitFor()
  const beforeReattach = await readSaved()
  await page
    .getByLabel('Recording file', { exact: true })
    .setInputFiles(recording())
  await settled(undefined, beforeReattach.revision)
  const verified = await readSaved()
  assert.equal(verified.audioAnalysis.pcmSha256, song.audioAnalysis.pcmSha256)
  assert.deepEqual(verified.syncTimes, manual.syncTimes)
  assert.equal(verified.syncSource, 'manual')
  assert.equal(verified.lyrics.cues[0].text, 'First line')
  // Same filename/size with different decoded PCM must not reuse manual timing.
  await page
    .getByLabel('Recording file', { exact: true })
    .setInputFiles(recording(2))
  await settled(song.audioAnalysis.pcmSha256)
  const replaced = await readSaved()
  assert.notEqual(
    replaced.audioAnalysis.pcmSha256,
    song.audioAnalysis.pcmSha256,
  )
  assert.notEqual(replaced.syncSource, 'manual')
  assert.equal(replaced.lyrics, undefined)
  await page.setViewportSize({ width: 390, height: 844 })
  if (process.env.SCREENSHOTS !== '0')
    await page.screenshot({
      path: 'test-results/rust-analysis-mobile.png',
      fullPage: true,
    })
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    'No horizontal overflow on mobile',
  )
  await page.goto(`${base}/`)
  await page.getByRole('region', { name: 'Tuner', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify(
      {
        analysisMs,
        serializedSongBytes: Buffer.byteLength(json),
        duration: seconds,
        engineVersion: song.audioAnalysis.analysis.engineVersion,
        harmonySpans: song.audioAnalysis.analysis.harmony.length,
        monophonicNotes: song.audioAnalysis.analysis.monophonicNotes.length,
        polyphonicNotes: song.audioAnalysis.analysis.polyphonicNotes.length,
        manualTimingPreservedAfterVerifiedReattachment: true,
        replacementInvalidatedManualTiming: true,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
