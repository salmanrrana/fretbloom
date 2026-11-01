import { spawn, spawnSync } from 'node:child_process'
import { access } from 'node:fs/promises'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
function port(value, fallback) {
  if (value === undefined) return fallback
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)
    throw new Error('Invalid service port.')
  return Number(value)
}
async function available(host, number) {
  const probe = createServer()
  try {
    await new Promise((ok, fail) => {
      probe.once('error', fail)
      probe.listen(number, host, ok)
    })
  } catch {
    throw new Error(
      `Port ${number} on ${host} is occupied; no existing service was stopped.`,
    )
  } finally {
    if (probe.listening) await new Promise((ok) => probe.close(ok))
  }
}
function validateHosting(dev) {
  const password = process.env.FRETBLOOM_ACCESS_PASSWORD
  const database = process.env.DATABASE_URL
  if (dev && (password || database))
    throw new Error(
      'dev:full refuses database and hosted credentials. Use an isolated local shell.',
    )
  const local =
    (dev || process.env.NODE_ENV === 'development') && !password && !database
  if (!local && (!password || password.length < 20 || !database))
    throw new Error(
      'Hosted startup requires DATABASE_URL and FRETBLOOM_ACCESS_PASSWORD (20+ characters); use NODE_ENV=development for browser-only local storage.',
    )
}
/** Two supervised process groups; Rust receives only explicitly allowed environment. */
export async function startFull({ development = false } = {}) {
  validateHosting(development)
  if (process.platform === 'win32')
    throw new Error(
      'Full process-group supervision currently requires Linux or macOS. Use the documented two-terminal mode on Windows.',
    )
  const host = process.env.FRETBLOOM_ANALYSIS_HOST ?? '127.0.0.1'
  if (host !== '127.0.0.1' && host !== '::1')
    throw new Error('Rust must listen on loopback.')
  const rustPort = port(process.env.FRETBLOOM_ANALYSIS_PORT, 5210)
  const publicPort = port(process.env.PORT, development ? 5202 : 4173)
  if (rustPort === publicPort)
    throw new Error('Rust and Node require different ports.')
  const nodeHost =
    process.env.HOST ??
    (development || process.env.NODE_ENV === 'development'
      ? '127.0.0.1'
      : '0.0.0.0')
  if (development && !['127.0.0.1', '::1'].includes(nodeHost))
    throw new Error('Development must listen on loopback.')
  const origin = `http://${host === '::1' ? '[::1]' : host}:${rustPort}`
  if (
    process.env.FRETBLOOM_ANALYSIS_ORIGIN &&
    process.env.FRETBLOOM_ANALYSIS_ORIGIN !== origin
  )
    throw new Error(
      'Analysis origin must match the private supervised listener.',
    )
  await available(host, rustPort)
  await available(nodeHost, publicPort)
  const ytDlp =
    process.env.YTDLP_PATH ?? resolve(root, '.tools/youtube/bin/yt-dlp')
  for (const [command, args] of [
    [process.env.FFMPEG_PATH ?? 'ffmpeg', ['-version']],
    [process.env.FFPROBE_PATH ?? 'ffprobe', ['-version']],
    [ytDlp, ['--version']],
  ]) {
    const result = spawnSync(command, args, {
      stdio: 'ignore',
      env: { PATH: process.env.PATH },
    })
    if (result.error || result.status !== 0)
      throw new Error(
        `Required tool unavailable: ${command}. Install FFmpeg/ffprobe and run npm run setup:youtube.`,
      )
  }
  if (development) {
    console.log('Building the pinned Rust workspace…')
    const buildEnv = {}
    for (const key of [
      'PATH',
      'HOME',
      'CARGO_HOME',
      'RUSTUP_HOME',
      'RUSTUP_TOOLCHAIN',
      'TMPDIR',
      'LANG',
      'LC_ALL',
    ])
      if (process.env[key]) buildEnv[key] = process.env[key]
    const result = spawnSync(
      'cargo',
      ['build', '--locked', '--release', '--workspace'],
      { cwd: root, stdio: 'inherit', env: buildEnv },
    )
    if (result.error || result.status !== 0)
      throw new Error(
        'Rust build failed. Install the pinned toolchain and complete the workspace first.',
      )
  }
  const binary = resolve(
    root,
    process.env.FRETBLOOM_ANALYSIS_BINARY ?? 'target/release/fretbloom-backend',
  )
  await access(binary)
  const rustEnv = {
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    FRETBLOOM_ANALYSIS_HOST: host,
    FRETBLOOM_ANALYSIS_PORT: String(rustPort),
    YTDLP_PATH: ytDlp,
    NODE_PATH_FOR_YTDLP: process.execPath,
  }
  for (const key of [
    'TMPDIR',
    'TEMP',
    'TMP',
    'LANG',
    'LC_ALL',
    'FFMPEG_PATH',
    'FFPROBE_PATH',
    'FRETBLOOM_ANALYSIS_TEMP_ROOT',
    'FRETBLOOM_SEPARATOR_PYTHON',
    'FRETBLOOM_SEPARATOR_HELPER',
    'FRETBLOOM_SEPARATOR_WEIGHTS',
    'FRETBLOOM_SEPARATOR_THREADS',
    'FRETBLOOM_SEPARATOR_MAX_RSS',
  ])
    if (process.env[key]) rustEnv[key] = process.env[key]
  const children = new Set()
  let stopping = false
  let exitCode = 0
  let finish
  const finished = new Promise((ok) => {
    finish = ok
  })
  const signalGroup = (child, signal) => {
    if (child.pid) {
      try {
        process.kill(-child.pid, signal)
      } catch (error) {
        if (error.code !== 'ESRCH')
          console.error(`Could not signal child: ${error.code}`)
      }
    }
  }
  const stop = (code = 0) => {
    if (stopping) return
    stopping = true
    exitCode = code
    for (const child of children) signalGroup(child, 'SIGTERM')
    const force = setTimeout(() => {
      for (const child of children) signalGroup(child, 'SIGKILL')
    }, 5000)
    const bound = setTimeout(() => {
      process.exitCode = exitCode
      finish()
    }, 7000)
    const settle = () => {
      if (!children.size) {
        clearTimeout(force)
        clearTimeout(bound)
        process.exitCode = exitCode
        finish()
      }
    }
    for (const child of children) child.once('exit', settle)
    settle()
  }
  const launch = (command, args, env) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: 'inherit',
      detached: true,
    })
    children.add(child)
    child.once('error', (error) => {
      console.error(error.message)
      children.delete(child)
      stop(1)
    })
    child.once('exit', (code, signal) => {
      // A dead group leader may leave descendants; terminate that group as well.
      signalGroup(child, 'SIGKILL')
      children.delete(child)
      if (!stopping) {
        console.error(
          `${command} exited (${signal ?? code}). Stopping the other service.`,
        )
        stop(code && code > 0 ? code : 1)
      }
    })
    return child
  }
  const interrupt = () => stop(130)
  const terminate = () => stop(143)
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', terminate)
  try {
    launch(binary, [], rustEnv)
    const until = Date.now() + 60_000
    let ready = false
    while (!stopping && Date.now() < until) {
      try {
        const response = await fetch(`${origin}/v1/capabilities`, {
          signal: AbortSignal.timeout(1000),
        })
        const data = await response.json()
        ready =
          response.ok &&
          data.schemaVersion === 1 &&
          typeof data.engineVersion === 'string' &&
          data.uploads === true
        if (ready) break
      } catch {
        /* Startup is bounded and does not admit the public server early. */
      }
      await new Promise((ok) => setTimeout(ok, 100))
    }
    if (!ready && !stopping)
      throw new Error(
        'Private Rust backend did not become ready within 60 seconds.',
      )
    if (!stopping) {
      const nodeEnv = {
        ...process.env,
        NODE_ENV: development
          ? 'development'
          : (process.env.NODE_ENV ?? 'production'),
        HOST: nodeHost,
        PORT: String(publicPort),
        FRETBLOOM_ANALYSIS_ORIGIN: origin,
      }
      launch(
        process.execPath,
        development
          ? [
              'node_modules/vite/bin/vite.js',
              '--host',
              nodeHost,
              '--port',
              String(publicPort),
              '--strictPort',
            ]
          : ['server/index.ts'],
        nodeEnv,
      )
      console.log(
        `Full app starting on http://${nodeHost}:${publicPort}; private analysis ready on ${origin}.`,
      )
    }
    await finished
  } catch (error) {
    console.error(error.message)
    stop(1)
    await finished
  } finally {
    process.removeListener('SIGINT', interrupt)
    process.removeListener('SIGTERM', terminate)
  }
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  await startFull()
