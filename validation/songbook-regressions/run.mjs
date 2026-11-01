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
import { verify } from '../../scripts/wasm-verify.mjs'

await verify()
const destination = resolve(process.argv[2] ?? 'target/songbook-regressions')
await mkdir(destination, { recursive: false }) // Preserve earlier attempts.
const temporary = await mkdtemp(resolve(tmpdir(), 'fretbloom-songbook-'))
const socket = netServer()
socket.listen(0, '127.0.0.1')
await once(socket, 'listening')
const address = socket.address()
assert.ok(address && typeof address !== 'string')
const port = address.port
await new Promise((done) => socket.close(done))
const origin = `http://127.0.0.1:${port}`
const backend = spawn(
  resolve(
    process.env.FRETBLOOM_TEST_BACKEND ?? 'target/release/fretbloom-backend',
  ),
  [],
  {
    env: {
      PATH: process.env.PATH,
      FRETBLOOM_ANALYSIS_LISTEN: `127.0.0.1:${port}`,
      FRETBLOOM_ANALYSIS_TEMP_ROOT: temporary,
      FFMPEG_PATH: process.env.FFMPEG_PATH ?? 'ffmpeg',
      FFPROBE_PATH: process.env.FFPROBE_PATH ?? 'ffprobe',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)
let backendLog = ''
await writeFile(
  resolve(destination, 'backend-pid.json'),
  JSON.stringify({ pid: backend.pid, port, temporary }),
)
backend.stdout.on('data', (chunk) => {
  backendLog += chunk
})
backend.stderr.on('data', (chunk) => {
  backendLog += chunk
})
let server, browser
const checks = [],
  errors = []
try {
  for (let i = 0; ; i++) {
    if (
      await fetch(`${origin}/v1/capabilities`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break
    assert.ok(
      i < 100 && backend.exitCode === null,
      'Private backend became ready',
    )
    await delay(50)
  }
  process.env.FRETBLOOM_ANALYSIS_ORIGIN = origin
  server = await createServer({
    cacheDir: resolve(destination, 'vite-cache'),
    server: { host: '127.0.0.1', port: 0, watch: null },
  })
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  let jobs = 0
  let maximumRms = 0
  const featureReads = []
  page.on('response', (response) => {
    if (response.ok() && response.url().endsWith('/features')) {
      featureReads.push(
        response.json().then((features) => {
          maximumRms = Math.max(
            maximumRms,
            ...features.frames.map((frame) => frame.rms),
          )
        }),
      )
    }
  })
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith('/api/analysis/v1/jobs')
    )
      jobs++
  })
  const saved = () =>
    page.locator('#saved-state').textContent().then(JSON.parse)
  const waitFor = async (condition) => {
    for (let i = 0; i < 100; i++) {
      if (await condition()) return
      await delay(50)
    }
    throw Error('Condition did not complete within 5 seconds')
  }
  async function check(name, run) {
    try {
      await run()
      checks.push({ name, pass: true })
    } catch (error) {
      checks.push({ name, pass: false, error: String(error) })
    }
  }
  await page.goto(
    `${server.resolvedUrls.local[0]}validation/songbook-regressions/index.html`,
  )
  await waitFor(async () => Boolean((await saved()).audioAnalysis))
  const original = await saved()
  assert.ok(original.audioAnalysis.analysis.monophonicNotes.length > 0)
  assert.ok(
    original.audioAnalysis.analysis.harmony.some(
      (h) => h.kind === 'no_chord' && h.reason === 'single_note',
    ),
  )
  await page.locator('audio').evaluate(async (audio) => {
    if (audio.readyState < 1)
      await new Promise((done) =>
        audio.addEventListener('loadedmetadata', done, { once: true }),
      )
    audio.currentTime = 0.8
  })
  await check(
    'actual monophonic audio highlights its timed tab note',
    async () => {
      await waitFor(() =>
        page
          .locator('.chord-card.note-step.now')
          .count()
          .then((n) => n === 1),
      )
    },
  )
  await page.locator('audio').evaluate((audio) => {
    audio.currentTime = 0.04
  })
  await check('silence does not highlight a tab note', async () => {
    await waitFor(() =>
      page
        .locator('.chord-card.note-step.now')
        .count()
        .then((n) => n === 0),
    )
  })
  const firstJobs = jobs
  await page
    .getByRole('button', { name: 'Reopen saved song', exact: true })
    .click()
  await delay(600)
  await check(
    'plain reopening preserves saved evidence without reanalysis',
    async () => {
      assert.equal(jobs, firstJobs)
      assert.equal(
        (await saved()).audioAnalysis.pcmSha256,
        original.audioAnalysis.pcmSha256,
      )
    },
  )
  await page
    .getByRole('button', { name: 'Open editor replacement', exact: true })
    .click()
  await check(
    'editor replacement analyzes and invalidates old recording timing',
    async () => {
      await waitFor(
        async () =>
          (await saved()).audioAnalysis.pcmSha256 !==
          original.audioAnalysis.pcmSha256,
      )
      assert.equal(jobs, firstJobs + 1)
      assert.notEqual((await saved()).syncSource, 'manual')
    },
  )
  await page
    .getByRole('button', { name: 'Open clipped float recording', exact: true })
    .click()
  await check(
    'real clipped float analysis retains its warning and original RMS',
    async () => {
      await waitFor(async () =>
        (await saved()).audioAnalysis.analysis.warnings.some(
          (warning) => warning.code === 'clipping',
        ),
      )
      await Promise.all(featureReads)
      assert.ok(
        maximumRms > 1,
        'The actual native features contain non-normalized RMS',
      )
      assert.equal(jobs, firstJobs + 2)
    },
  )
  assert.deepEqual(errors, [])
} finally {
  await browser?.close()
  await server?.close()
  if (backend.exitCode === null && backend.signalCode === null) {
    backend.kill('SIGTERM')
    await once(backend, 'exit')
  }
  await writeFile(resolve(destination, 'backend.log'), backendLog)
  await writeFile(
    resolve(destination, 'results.json'),
    JSON.stringify({ checks, errors }, null, 2) + '\n',
  )
  await rm(temporary, { recursive: true, force: true })
}
console.log(JSON.stringify(checks))
assert.ok(
  checks.length === 5 && checks.every((c) => c.pass),
  'Songbook regression checks',
)
