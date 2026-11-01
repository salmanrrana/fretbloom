/** Build both representations from the exact same raw Rust module. */
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { numericInput } from './wasm-portable-metadata.mjs'
import { guardWat } from './wasm-asyncify-bounds.mjs'
import { adaptPortable } from './wasm-portable-adapter.mjs'
import { verifyBinaryen, binaryenPath } from './wasm-binaryen-tools.mjs'
const sha = (b) => createHash('sha256').update(b).digest('hex')
export const portablePin = {
  raw: '4e8d5b329269b59f853962982a4cd73fd0ca3334497716be6ad531632b0d5870',
  numericInput:
    'c170d7408449565a8e4df9d01e00c9f33d77bfdf1ce0220cdd4c779eafce56a8',
  numericModule:
    'df38624da7d2b0de9e995ea3866aada40ac7c2223dbceaa2888165761ad6587e',
  asyncifiedModule:
    '109c4df725ebbdca8e4300f9b9ef2496e88a2930a318e8667377ec9c97dc7f34',
  // Exhaustive pinned-module inventory; pre-access and cursor-update controls
  // retained in the completion evidence. Generation refuses any drift.
  guardedCounts: {
    callIndexLoads: 653,
    callIndexStores: 653,
    localLoads: 11960,
    localStores: 11960,
    cursorLocals: 1270,
    metadataReads: 5160,
    metadataWrites: 2576,
    cursorUpdates: 2576,
  },
}
let commands = []
function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  })
  commands.push({
    command,
    args,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    error: String(result.error ?? ''),
  })
  if (result.error || result.status !== 0)
    throw Error(`Portable generation failed: ${command}`)
}
export async function buildPortable(raw, output, bindgen) {
  if (portablePin.guardedCounts === null)
    throw Error(
      'BLOCKED: portable pre-write stack guards have not completed structural inventory and safe overflow/rewind controls; no fallback artifact may be published',
    )
  await verifyBinaryen()
  commands = []
  if (sha(raw) !== portablePin.raw) throw Error('Unreviewed raw Rust module')
  const numeric = numericInput(raw)
  if (sha(numeric.bytes) !== portablePin.numericInput)
    throw Error('Numeric metadata identity drift')
  const directory = resolve(output, 'portable')
  await mkdir(directory)
  const temporary = resolve(directory, 'numeric-input.wasm')
  await writeFile(temporary, numeric.bytes)
  try {
    run(bindgen, [
      temporary,
      '--target',
      'web',
      '--out-dir',
      directory,
      '--out-name',
      'fretbloom_wasm',
    ])
    const wasmPath = resolve(directory, 'fretbloom_wasm_bg.wasm')
    if (sha(await readFile(wasmPath)) !== portablePin.numericModule)
      throw Error('Numeric module ABI drift')
    const transformed = resolve(directory, 'asyncified.wasm'),
      watPath = resolve(directory, 'asyncified.wat'),
      guardedPath = resolve(directory, 'guarded.wat')
    try {
      run(binaryenPath('wasm-opt'), [
        wasmPath,
        '--all-features',
        '--asyncify',
        '--pass-arg=asyncify-imports@fretbloom_host.poll',
        '--pass-arg=asyncify-asserts',
        '-o',
        transformed,
      ])
      if (sha(await readFile(transformed)) !== portablePin.asyncifiedModule)
        throw Error('Asyncify transform drift')
      run(binaryenPath('wasm-dis'), [transformed, '-o', watPath])
      const guard = guardWat(await readFile(watPath, 'utf8'))
      if (
        JSON.stringify(guard.evidence.counts) !==
        JSON.stringify(portablePin.guardedCounts)
      )
        throw Error('Asyncify access inventory drift')
      await writeFile(guardedPath, guard.text)
      run(binaryenPath('wasm-as'), [
        guardedPath,
        '--all-features',
        '-o',
        wasmPath,
      ])
      await writeFile(
        resolve(directory, 'generation.json'),
        JSON.stringify(
          {
            metadata: numeric.evidence,
            bounds: guard.evidence,
            adapter: await adaptPortable(directory),
          },
          null,
          2,
        ) + '\n',
      )
    } catch (error) {
      const failure = resolve(
        output,
        '../../../target/wasm-failures',
        'portable-' + new Date().toISOString().replaceAll(':', '-'),
      )
      await mkdir(failure, { recursive: true })
      await cp(directory, resolve(failure, 'intermediates'), {
        recursive: true,
      })
      await writeFile(resolve(failure, 'raw-input.wasm'), raw)
      await writeFile(
        resolve(failure, 'failure.json'),
        JSON.stringify(
          { error: String(error.stack ?? error), commands },
          null,
          2,
        ),
      )
      throw error
    } finally {
      for (const file of [transformed, watPath, guardedPath])
        await rm(file, { force: true })
    }
  } finally {
    await rm(temporary, { force: true })
  }
}
