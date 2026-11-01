import { buildPortable, portablePin } from './wasm-portable-build.mjs'
import { adapt } from './wasm-jspi-adapter.mjs'
import { spawnSync } from 'node:child_process'
import {
  mkdtemp,
  readFile,
  writeFile,
  rename,
  rm,
  mkdir,
  cp,
} from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { homedir } from 'node:os'
import {
  artifactNames,
  root,
  sha256,
  sourceIdentity,
  tools,
  verify,
} from './wasm-verify.mjs'
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed: ${result.error?.message ?? result.status}`,
    )
  return result.stdout.trim()
}
async function publish(directory) {
  await verify(directory)
  const dest = resolve(root, 'src/generated/analysis-wasm'),
    backup = `${directory}-previous`
  await rename(dest, backup)
  try {
    await rename(directory, dest)
  } catch (error) {
    await rename(backup, dest)
    throw error
  }
  await rm(backup, { recursive: true, force: true })
  await verify()
}
const publishIndex = process.argv.indexOf('--publish')
if (publishIndex >= 0) {
  const directory = resolve(root, process.argv[publishIndex + 1] ?? '')
  if (!directory.startsWith(resolve(root, 'src/generated/.analysis-wasm-')))
    throw new Error('Publish only a verified staged WASM build')
  await publish(directory)
  process.exit(0)
}
if (portablePin.guardedCounts === null)
  throw new Error(
    'BLOCKED: exact Asyncify access inventory and safe pre-write/rewind controls are unvalidated; no portable artifact may be generated',
  )
if (process.versions.node !== tools.node)
  throw new Error(`Use Node ${tools.node}; observed ${process.versions.node}`)
if (
  !run(
    process.env.RUSTC ?? 'rustc',
    process.env.RUSTC ? ['--version'] : ['+1.89.0', '--version'],
  ).startsWith('rustc 1.89.0 ')
)
  throw new Error('Rust pin mismatch')
const cli = resolve(root, '.tools/wasm-bindgen-0.2.100/bin/wasm-bindgen')
if (run(cli, ['--version']) !== 'wasm-bindgen 0.2.100')
  throw new Error('wasm-bindgen pin mismatch; run wasm:bootstrap')
if (process.env.RUSTFLAGS || process.env.CARGO_ENCODED_RUSTFLAGS)
  throw new Error(
    'Unset RUSTFLAGS/CARGO_ENCODED_RUSTFLAGS; the recorded target-only WASM flags must be authoritative',
  )
const before = await sourceIdentity()
const out = await mkdtemp(resolve(root, 'src/generated/.analysis-wasm-'))
let retained = false
try {
  run(
    process.env.FRETBLOOM_CARGO ?? 'cargo',
    [
      ...(process.env.FRETBLOOM_CARGO ? [] : ['+1.89.0']),
      'build',
      '--locked',
      '--offline',
      '--release',
      '-p',
      'fretbloom-wasm',
      '--lib',
      '--target',
      tools.target,
    ],
    {
      ...process.env,
      // wasm-bindgen-shared 0.2.100 otherwise embeds an ancestor Git HEAD.
      // Pin the already-tested metadata and stop discovery above the registry.
      WBG_VERSION: 'ed6507981',
      GIT_CEILING_DIRECTORIES: resolve(
        process.env.CARGO_HOME ?? resolve(homedir(), '.cargo'),
      ),
      CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS: tools.rustflags
        .replace('<source-root>', root.replace(/\/$/, ''))
        .replace(
          '<cargo-home>',
          resolve(process.env.CARGO_HOME ?? resolve(homedir(), '.cargo')),
        ),
    },
  )
  // Capture Cargo output exactly once. Both derivations use this staged
  // snapshot/buffer, never a second read of the mutable Cargo output path.
  const raw = await readFile(
    resolve(
      process.env.CARGO_TARGET_DIR ?? resolve(root, 'target'),
      'wasm32-unknown-unknown/release/fretbloom_wasm.wasm',
    ),
  )
  if (sha256(raw) !== portablePin.raw)
    throw new Error('Raw Cargo module identity drift')
  const snapshot = resolve(out, '.raw-input.wasm')
  await writeFile(snapshot, raw, { flag: 'wx', mode: 0o444 })
  run(cli, [
    snapshot,
    '--target',
    'web',
    '--out-dir',
    out,
    '--out-name',
    'fretbloom_wasm',
  ])
  await adapt(out)
  if (
    sha256(await readFile(resolve(out, 'fretbloom_wasm_bg.wasm'))) !==
    'a2be0bfd51b2cd28d543d272bfc0f55648626781aeda7d72ca9ecf8f8f806cf7'
  )
    throw new Error('Reference WASM identity drift')
  await buildPortable(raw, out, cli)
  await rm(snapshot)
  const after = await sourceIdentity()
  if (before.sourceHash !== after.sourceHash)
    throw new Error(
      'Sources changed during WASM build; wait for the DSP source handoff and rebuild',
    )
  const generated = await import(
    pathToFileURL(resolve(out, 'fretbloom_wasm.js')).href
  )
  await generated.default({
    module_or_path: await readFile(resolve(out, 'fretbloom_wasm_bg.wasm')),
  })
  const info = JSON.parse(generated.engine_info_json())
  if (
    info.bridgeVersion !== 2 ||
    info.schemaVersion !== 1 ||
    info.sampleRateHz !== 24000 ||
    info.maxSamples !== 7200000 ||
    typeof info.engineVersion !== 'string'
  )
    throw new Error('Generated engine info mismatch')
  const engineVersion = info.engineVersion
  const artifacts = Object.fromEntries(
    await Promise.all(
      artifactNames.map(async (name) => [
        name,
        sha256(await readFile(resolve(out, name))),
      ]),
    ),
  )
  await writeFile(
    resolve(out, 'manifest.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        bridgeVersion: 2,
        engineVersion,
        tools,
        ...before,
        artifacts,
      },
      null,
      2,
    ) + '\n',
  )
  if (process.argv.includes('--stage')) {
    await verify(out)
    retained = true
    console.log(
      `WASM staged at ${out}; publish with node scripts/wasm-build.mjs --publish ${out}`,
    )
  } else if (process.argv.includes('--check')) {
    const old = await verify()
    if (JSON.stringify(old.artifacts) !== JSON.stringify(artifacts))
      throw new Error('Fresh build differs from tracked artifacts')
    console.log('Fresh build matches checked-in WASM artifacts')
  } else {
    await publish(out)
  }
} catch (error) {
  const failure = resolve(
    root,
    'target/wasm-failures',
    new Date().toISOString().replaceAll(':', '-'),
  )
  await mkdir(failure, { recursive: true })
  await cp(out, resolve(failure, 'stage'), { recursive: true })
  await writeFile(
    resolve(failure, 'failure.json'),
    JSON.stringify(
      { error: String(error.stack ?? error), source: before, tools },
      null,
      2,
    ),
  )
  throw error
} finally {
  if (!retained) await rm(out, { recursive: true, force: true })
}
