// Reproduces the stale-upload reopen path through the real SongbookMode parent.
// Usage (cwd repo root): node validation/songbook-regressions/parent/run.mjs <new output dir>
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer as netServer } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { verify } from '../../../scripts/wasm-verify.mjs'

await verify()
const destination = resolve(process.argv[2])
await mkdir(destination, { recursive: false }) // Never overwrite earlier output.
const temporary = await mkdtemp(resolve(tmpdir(), 'fretbloom-root-parent-'))
const profile = await mkdtemp(resolve(tmpdir(), 'fretbloom-root-profile-'))
const socket = netServer()
socket.listen(0, '127.0.0.1')
await once(socket, 'listening')
const port = socket.address().port
await new Promise((done) => socket.close(done))
const origin = `http://127.0.0.1:${port}`

// Same 5 s mono WAV shape as validation/songbook-regressions/page.tsx.
function wav(hz) {
  const samples = 5 * 24000
  const bytes = Buffer.alloc(44 + samples * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(24000, 24)
  bytes.writeUInt32LE(48000, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++) {
    const value =
      i < 6000 || i >= samples - 6000
        ? 0
        : Math.sin((2 * Math.PI * hz * i) / 24000) * 8000
    bytes.writeInt16LE(Math.trunc(value), 44 + i * 2)
  }
  return { name: `tone-${hz}.wav`, mimeType: 'audio/wav', buffer: bytes }
}

const backend = spawn(resolve(process.env.FRETBLOOM_TEST_BACKEND), [], {
  env: {
    PATH: process.env.PATH,
    FRETBLOOM_ANALYSIS_LISTEN: `127.0.0.1:${port}`,
    FRETBLOOM_ANALYSIS_TEMP_ROOT: temporary,
    FFMPEG_PATH: process.env.FFMPEG_PATH,
    FFPROBE_PATH: process.env.FFPROBE_PATH,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let backendLog = ''
backend.stdout.on('data', (c) => (backendLog += c))
backend.stderr.on('data', (c) => (backendLog += c))
await writeFile(
  resolve(destination, 'backend-pid.json'),
  JSON.stringify({ pid: backend.pid, port, temporary, profile }),
)
let server, context
const steps = [],
  errors = []
try {
  for (let i = 0; ; i++) {
    if (
      await fetch(`${origin}/v1/capabilities`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break
    assert.ok(i < 100 && backend.exitCode === null, 'backend ready')
    await delay(50)
  }
  process.env.FRETBLOOM_ANALYSIS_ORIGIN = origin
  server = await createServer({
    cacheDir: resolve(destination, 'vite-cache'),
    server: { host: '127.0.0.1', port: 0, watch: null },
  })
  await server.listen()
  context = await chromium.launchPersistentContext(profile, { headless: true })
  const page = context.pages()[0] ?? (await context.newPage())
  page.on('pageerror', (error) => errors.push(error.message))
  let jobs = 0
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith('/api/analysis/v1/jobs')
    )
      jobs++
  })
  const stored = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('fretbloom.songbook.v1') ?? '[]'),
    )
  const song = async () => (await stored())[0]
  const waitFor = async (label, condition, ms = 20000) => {
    for (let i = 0; i < ms / 100; i++) {
      if (await condition()) return
      await delay(100)
    }
    throw Error(`Timed out: ${label}`)
  }
  const snapshot = async (label) => {
    const s = await song()
    steps.push({
      label,
      jobs,
      pcmSha256: s?.audioAnalysis?.pcmSha256 ?? null,
      uploadName: s?.uploadSource?.name ?? null,
      syncSource: s?.syncSource ?? null,
      syncTimes: s?.syncTimes ?? null,
    })
    return s
  }

  for (const navigation of ['back', 'edit-cancel']) {
    await page.goto(
      `${server.resolvedUrls.local[0]}validation/songbook-regressions/parent/index.html`,
    )
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page
      .locator('textarea.songbook-paste')
      .fill('e|--5--|\nB|-----|\nG|-----|\nD|-----|\nA|-----|\nE|-----|')
    await page.locator('#song-upload').setInputFiles(wav(440))
    await page.getByRole('button', { name: 'Save song', exact: true }).click()
    await waitFor('A saved', async () => Boolean((await song())?.audioAnalysis))
    const a = await snapshot(`${navigation}: created A`)
    await page.getByLabel('Recording file').setInputFiles(wav(880))
    await waitFor(
      'B saved',
      async () =>
        Boolean((await song())?.audioAnalysis) &&
        (await song()).audioAnalysis.pcmSha256 !== a.audioAnalysis.pcmSha256,
    )
    await page
      .getByRole('button', { name: 'Set timing manually', exact: true })
      .click()
    await page.waitForFunction(
      () => document.querySelector('audio')?.currentTime > 0.1,
    )
    await page.getByRole('button', { name: 'A4 now', exact: true }).click()
    await page
      .getByRole('button', { name: 'Lyrics & notes', exact: true })
      .click()
    await page
      .locator('#upload-lyrics')
      .fill('[00:00.40]Keep recording B lyrics')
    await page.getByRole('button', { name: 'Save lyrics', exact: true }).click()
    const b = await snapshot(`${navigation}: B with manual timing and lyrics`)
    assert.equal(b.syncSource, 'manual')
    assert.ok(b.lyrics)
    const jobsAfterB = jobs
    if (navigation === 'back') {
      await page.getByRole('button', { name: '← Songbook' }).click()
      await page.locator('.songbook-open').first().click()
    } else {
      await page.locator('.player-edit').click()
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    }
    await page.locator('.audio-analysis').waitFor()
    await delay(1000)
    const startedJob = jobs > jobsAfterB
    if (startedJob)
      await waitFor(
        'unexpected job settles',
        async () =>
          (await song())?.audioAnalysis?.pcmSha256 !==
          b.audioAnalysis.pcmSha256,
      ).catch(() => {})
    const after = await snapshot(`${navigation}: reopened without a file`)
    const result = {
      navigation,
      newJobOnReopen: startedJob,
      keptB: after.audioAnalysis.pcmSha256 === b.audioAnalysis.pcmSha256,
      keptTiming:
        after.syncSource === b.syncSource &&
        JSON.stringify(after.syncTimes) === JSON.stringify(b.syncTimes),
      keptLyrics: JSON.stringify(after.lyrics) === JSON.stringify(b.lyrics),
      hashes: { a: a.audioAnalysis.pcmSha256, b: b.audioAnalysis.pcmSha256 },
    }
    steps.push({ result })
  }
  assert.deepEqual(errors, [])
  assert.ok(
    steps
      .filter((step) => step.result)
      .every(
        ({ result }) =>
          !result.newJobOnReopen &&
          result.keptB &&
          result.keptTiming &&
          result.keptLyrics,
      ),
    'Both parent navigation paths must preserve recording B without replaying A',
  )
} finally {
  await context?.close()
  await server?.close()
  if (backend.exitCode === null && backend.signalCode === null) {
    backend.kill('SIGTERM')
    await once(backend, 'exit')
  }
  await writeFile(resolve(destination, 'backend.log'), backendLog)
  await writeFile(
    resolve(destination, 'results.json'),
    JSON.stringify({ steps, errors }, null, 2) + '\n',
  )
  await rm(temporary, { recursive: true, force: true })
  await rm(profile, { recursive: true, force: true })
}
console.log(JSON.stringify(steps.at(-1)))
