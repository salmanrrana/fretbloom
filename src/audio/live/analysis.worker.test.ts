import { it, expect } from 'vitest'
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir, cpus, platform, release } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  initialize,
  analyze,
  info,
  memoryBytes,
  close,
} from '../../generated/analysis-wasm/portable/fretbloom_wasm'
import { parseOutput } from './validation'
import { object, string } from '../analysisV1'
const hash = (value: Uint8Array) =>
  createHash('sha256').update(value).digest('hex')
function equivalent(a: unknown, b: unknown, path = 'output'): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), path).toBeLessThanOrEqual(1e-5)
    return
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(a.length, path).toBe(b.length)
    for (let i = 0; i < a.length; i++) equivalent(a[i], b[i], `${path}[${i}]`)
    return
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object'
  ) {
    const x = object(a),
      y = object(b)
    expect(Object.keys(x).sort(), path).toEqual(Object.keys(y).sort())
    for (const k of Object.keys(x)) equivalent(x[k], y[k], `${path}.${k}`)
    return
  }
  expect(a, path).toEqual(b)
}
function waveform(seconds: number): Float32Array<ArrayBuffer> {
  return Float32Array.from({ length: Math.round(seconds * 24000) }, (_, i) => {
    const t = i / 24000,
      phase = t % 2,
      envelope = Math.min(1, phase / 0.01) * Math.exp(-phase * 0.6)
    return (
      envelope *
      [110, 164.813778, 220, 277.18263, 329.627557].reduce(
        (sum, hz, voice) =>
          sum +
          (0.07 / (1 + voice * 0.2)) *
            (Math.sin(2 * Math.PI * hz * t) +
              0.3 * Math.sin(4 * Math.PI * hz * t)),
        0,
      )
    )
  })
}
it('runs the actual portable Rust WASM against matching native PCM, and measures full-context cost', async () => {
  const manifest = object(
    JSON.parse(
      await readFile('src/generated/analysis-wasm/manifest.json', 'utf8'),
    ),
  )
  const wasmBytes = await readFile(
      'src/generated/analysis-wasm/portable/fretbloom_wasm_bg.wasm',
    ),
    artifacts = object(manifest.artifacts)
  expect(hash(wasmBytes)).toBe(artifacts['portable/fretbloom_wasm_bg.wasm'])
  const verify = spawnSync(process.execPath, ['scripts/wasm-verify.mjs'], {
    encoding: 'utf8',
  })
  expect(verify.status, verify.stderr).toBe(0)
  const build = spawnSync(
    process.env.FRETBLOOM_CARGO ?? 'cargo',
    [
      ...(process.env.FRETBLOOM_CARGO ? [] : ['+1.89.0']),
      'build',
      '--locked',
      '--release',
      '-p',
      'fretbloom-analysis',
      '--bin',
      'analyze-pcm',
    ],
    { encoding: 'utf8' },
  )
  expect(build.status, build.stderr).toBe(0)
  const source = await readFile('crates/fretbloom-analysis/src/lib.rs'),
    sources = object(manifest.sources)
  expect(hash(source)).toBe(sources['crates/fretbloom-analysis/src/lib.rs'])
  const load = performance.now(),
    loadPromise = initialize(wasmBytes)
  await loadPromise
  const loadMs = performance.now() - load
  const engine = object(JSON.parse(info())),
    engineVersion = string(engine.engineVersion, 100)
  expect(engineVersion).toBe(manifest.engineVersion)
  const folder = await mkdtemp(join(tmpdir(), 'fretbloom-wasm-parity-')),
    durations: number[] = []
  try {
    for (const mode of ['auto', 'monophonic', 'polyphonic'])
      for (const seconds of [2.56, 5.12, 65536 / 24000, 61696 / 24000]) {
        const pcm = waveform(seconds),
          options = {
            mode,
            concertAHz: mode === 'auto' ? 440 : 442,
            spelling: mode === 'monophonic' ? 'flats' : 'sharps',
          },
          input = join(folder, 'input.f32le'),
          output = join(folder, 'output.json')
        await writeFile(input, new Uint8Array(pcm.buffer))
        const native = spawnSync(
          resolve(
            process.env.CARGO_TARGET_DIR ?? 'target',
            'release/analyze-pcm',
          ),
          [
            '--input',
            input,
            '--sample-rate',
            '24000',
            '--mode',
            mode,
            '--concert-a-hz',
            String(options.concertAHz),
            '--spelling',
            options.spelling,
            '--output',
            output,
          ],
          { encoding: 'utf8' },
        )
        expect(native.status, native.stderr).toBe(0)
        const before = performance.now(),
          actual = parseOutput(
            JSON.parse(await analyze(pcm, 24000, JSON.stringify(options))),
            pcm.length,
            engineVersion,
          )
        durations.push(performance.now() - before)
        equivalent(
          actual,
          parseOutput(
            JSON.parse(await readFile(output, 'utf8')),
            pcm.length,
            engineVersion,
          ),
        )
      }
    const resource = []
    for (const seconds of [30, 300]) {
      const pcm = waveform(seconds),
        before = performance.now()
      const output = parseOutput(
        JSON.parse(
          await analyze(
            pcm,
            24000,
            JSON.stringify({
              mode: 'polyphonic',
              concertAHz: 440,
              spelling: 'sharps',
            }),
          ),
        ),
        pcm.length,
        engineVersion,
      )
      resource.push({
        seconds,
        computeMs: performance.now() - before,
        wasmBytes: memoryBytes(),
        notes: output.result.polyphonicNotes.length,
      })
    }
    console.log(
      JSON.stringify({
        sourceHash: manifest.sourceHash,
        wasmSha256: hash(wasmBytes),
        nativeSha256: hash(
          await readFile(
            resolve(
              process.env.CARGO_TARGET_DIR ?? 'target',
              'release/analyze-pcm',
            ),
          ),
        ),
        engineVersion,
        node: process.version,
        cpu: cpus()[0].model,
        os: `${platform()} ${release()}`,
        wasmArtifactBytes: wasmBytes.length,
        loadMs,
        windowComputeMs: durations,
        resource,
      }),
    )
  } finally {
    close()
    await rm(folder, { recursive: true, force: true })
  }
}, 180000)
