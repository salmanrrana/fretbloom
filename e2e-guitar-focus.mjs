/** Real local server integration, including saved legacy provenance and the shared audio clock. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = process.cwd()
const output = resolve('validation/guitar-isolation/runs')
await mkdir(output, { recursive: true })
async function freePort() {
  const s = createServer()
  await new Promise((ok, fail) => {
    s.once('error', fail)
    s.listen(0, '127.0.0.1', ok)
  })
  const p = s.address().port
  await new Promise((ok) => s.close(ok))
  return p
}
const rustPort = await freePort(),
  port = await freePort()
assert.ok(
  ![4173, 5202, 5210].includes(port) && ![4173, 5202, 5210].includes(rustPort),
)
const env = {
  PATH: `${root}/.tools/ffmpeg/bin:/usr/bin:/bin`,
  HOME: '/tmp',
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  PORT: String(port),
  FRETBLOOM_ANALYSIS_PORT: String(rustPort),
  FRETBLOOM_ANALYSIS_ORIGIN: `http://127.0.0.1:${rustPort}`,
}
const children = []
const logs = []
function launch(command, args) {
  const c = spawn(command, args, {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.push(c)
  c.stdout.on('data', (d) => logs.push(d.toString()))
  c.stderr.on('data', (d) => logs.push(d.toString()))
  return c
}
let browser
const base = `http://127.0.0.1:${port}`
const readSaved = (page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('fretbloom.songbook.v1') ?? '[]')[0],
  )
async function settled(page, revision = 0) {
  await page.waitForFunction(
    (revision) => {
      const s = JSON.parse(
        localStorage.getItem('fretbloom.songbook.v1') ?? '[]',
      )[0]
      return s?.audioAnalysis?.analyzedAudio && s.revision > revision
    },
    revision,
    { timeout: 240000 },
  )
  await page
    .getByRole('button', { name: 'Analyze recording again', exact: true })
    .waitFor({ timeout: 240000 })
}
try {
  launch(resolve('target/release/fretbloom-backend'), [])
  for (let i = 0; i < 600; i++) {
    try {
      const c = await fetch(`${env.FRETBLOOM_ANALYSIS_ORIGIN}/v1/capabilities`)
      if (c.ok) {
        assert.equal((await c.json()).separation.available, true)
        break
      }
    } catch {}
    await new Promise((ok) => setTimeout(ok, 100))
    if (i === 599) throw Error('Backend startup timeout')
  }
  launch(process.execPath, ['server/index.ts'])
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) break
    } catch {}
    await new Promise((ok) => setTimeout(ok, 100))
  }
  browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const context = await browser.newContext({
    viewport: { width: 1360, height: 1000 },
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}/songbook`)
  await page
    .getByLabel('Song title', { exact: true })
    .fill('Guitar focus development')
  await page.getByLabel('Paste tab', { exact: true }).fill('C')
  // 8-second crop of a declared DEV mixture, never an acceptance holdout.
  const original = await readFile(
    resolve('validation/guitar-isolation/source/01_Jazz3-150-C_comp-mix.wav'),
  )
  const wav = Buffer.from(original.subarray(0, 44 + 8 * 44100 * 2))
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.writeUInt32LE(wav.length - 44, 40)
  const file = {
    name: 'guitar-focus-dev.wav',
    mimeType: 'audio/wav',
    buffer: wav,
  }
  await page.getByLabel('Upload recording', { exact: true }).setInputFiles(file)
  await page.getByRole('button', { name: 'Save song', exact: true }).click()
  await settled(page)
  let song = await readSaved(page)
  assert.equal(song.audioAnalysis.analyzedAudio.kind, 'guitar_stem')
  await page
    .getByText('Chords found in: isolated guitar (htdemucs_6s)', {
      exact: true,
    })
    .waitFor()
  await page
    .getByLabel('Focus on guitar', { exact: true })
    .isChecked()
    .then((v) => assert.equal(v, true))
  // A second page has no session audio: saved guitar provenance/focus must still survive.
  const reopened = await page.context().newPage()
  await reopened.goto(`${base}/songbook`)
  await reopened
    .locator('.songbook-open')
    .filter({ hasText: 'Guitar focus development' })
    .click()
  await reopened
    .getByText('Chords found in: isolated guitar (htdemucs_6s)', {
      exact: true,
    })
    .waitFor()
  assert.equal(
    await reopened.getByLabel('Focus on guitar', { exact: true }).isChecked(),
    true,
  )
  assert.equal(await reopened.getByLabel('Hear', { exact: true }).count(), 0)
  await reopened.close()
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await page.waitForFunction(
    () => document.querySelector('audio')?.currentTime > 0.2,
  )
  await page.getByRole('button', { name: 'Pause song', exact: true }).click()
  await page.getByLabel('Playback speed', { exact: true }).selectOption('0.75')
  await page.getByLabel('Song position', { exact: true }).fill('2.5')
  await page.getByLabel('Hear', { exact: true }).selectOption('guitar')
  await page.waitForFunction(
    () => Math.abs(document.querySelector('audio')?.currentTime - 2.5) < 0.05,
  )
  assert.equal(await page.locator('audio').evaluate((e) => e.paused), true)
  assert.equal(
    await page.locator('audio').evaluate((e) => e.playbackRate),
    0.75,
  )
  console.log(
    'paused switch',
    await page.locator('.song-transport').innerText(),
  )
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await page.waitForFunction(
    () => document.querySelector('audio')?.currentTime > 2.6,
  )
  const before = await page.locator('audio').evaluate((e) => e.currentTime)
  await page.getByLabel('Hear', { exact: true }).selectOption('original')
  await page.waitForFunction((t) => {
    const e = document.querySelector('audio')
    return e && !e.paused && e.currentTime >= t && e.currentTime < t + 0.75
  }, before)
  assert.equal(
    await page.locator('audio').evaluate((e) => e.playbackRate),
    0.75,
  )
  await page.getByRole('button', { name: 'Pause song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Set timing manually', exact: true })
    .click()
  await page.waitForFunction(
    () => document.querySelector('audio')?.currentTime > 0.1,
  )
  await page.getByRole('button', { name: 'C now', exact: true }).click()
  const manual = await readSaved(page)
  assert.equal(manual.syncSource, 'manual')
  await page
    .getByRole('button', { name: 'Lyrics & notes', exact: true })
    .click()
  await page
    .locator('#upload-lyrics')
    .fill('[00:00.40]First line\n[00:02.60]Second line')
  await page.getByRole('button', { name: 'Save lyrics', exact: true }).click()
  song = await readSaved(page)
  await page.getByLabel('Focus on guitar', { exact: true }).uncheck()
  await page
    .getByRole('button', { name: 'Analyze recording again', exact: true })
    .click()
  await settled(page, song.revision)
  const full = await readSaved(page)
  assert.equal(full.audioAnalysis.analyzedAudio.kind, 'full_mix')
  assert.equal(full.audioAnalysis.pcmSha256, song.audioAnalysis.pcmSha256)
  assert.deepEqual(full.syncTimes, manual.syncTimes)
  assert.equal(full.syncSource, 'manual')
  assert.equal(full.lyrics.cues[0].text, 'First line')
  await page.screenshot({
    path: resolve(output, 'desktop.png'),
    fullPage: true,
  })
  await page.reload()
  await page
    .locator('.songbook-open')
    .filter({ hasText: 'Guitar focus development' })
    .click()
  await page.getByText('Chords found in: full mix', { exact: true }).waitFor()
  assert.equal(
    await page.getByLabel('Focus on guitar', { exact: true }).isChecked(),
    false,
  )
  assert.equal(await page.getByLabel('Hear', { exact: true }).count(), 0)
  assert.deepEqual((await readSaved(page)).syncTimes, manual.syncTimes)
  // A real saved v1 analysis from before this addition remains readable.
  await page.evaluate(() => {
    const songs = JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))
    delete songs[0].audioAnalysis.analyzedAudio
    localStorage.setItem('fretbloom.songbook.v1', JSON.stringify(songs))
  })
  await page.reload()
  await page
    .locator('.songbook-open')
    .filter({ hasText: 'Guitar focus development' })
    .click()
  await page.getByText('Full mix (earlier analysis)', { exact: true }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: resolve(output, 'mobile.png'), fullPage: true })
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  )
  assert.deepEqual(errors, [])
  await writeFile(
    resolve(output, 'browser.json'),
    JSON.stringify(
      {
        passed: true,
        ports: { rustPort, port },
        originalIdentity: full.audioAnalysis.pcmSha256,
        guitarIdentity: song.audioAnalysis.analyzedAudio.pcmSha256,
        manualTiming: manual.syncTimes,
        lyricsSurvived: true,
        pausedSwitchPreserved: true,
        playingSwitchPreserved: true,
        legacyReadable: true,
        savedGuitarReopened: true,
        speedSwitchPreserved: true,
        errors,
      },
      null,
      2,
    ),
  )
} finally {
  await browser?.close()
  for (const c of children) c.kill('SIGTERM')
  for (const c of children)
    if (c.exitCode === null)
      await new Promise((ok) => {
        const t = setTimeout(() => {
          c.kill('SIGKILL')
          ok()
        }, 10000)
        c.once('exit', () => {
          clearTimeout(t)
          ok()
        })
      })
  await writeFile(resolve(output, 'browser-servers.log'), logs.join(''))
}
