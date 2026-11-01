import { binaryenPin, binaryenTools } from './wasm-binaryen-tools.mjs'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
export const root = fileURLToPath(new URL('../', import.meta.url))
export const tools = {
  rust: '1.89.0',
  binaryen: { ...binaryenPin, binaries: binaryenTools },
  portableStackGuard:
    'per-access unsigned pre-read/pre-write bounds v1; exact inventory required',
  target: 'wasm32-unknown-unknown',
  wasmBindgen: '0.2.100',
  node: '24.22.2',
  rustflags:
    '-C link-arg=--max-memory=134217728 --remap-path-prefix=<source-root>=/workspace --remap-path-prefix=<cargo-home>=/cargo',
  targetFeatures: 'portable; no simd128, atomics or shared memory',
  profile: 'release',
  bindgenTarget: 'web',
}
export const artifactNames = [
  'fretbloom_wasm.js',
  'fretbloom_wasm.d.ts',
  'fretbloom_wasm_bg.wasm',
  'fretbloom_wasm_bg.wasm.d.ts',
  'portable/fretbloom_wasm.js',
  'portable/fretbloom_wasm.d.ts',
  'portable/fretbloom_wasm_bg.wasm',
  'portable/fretbloom_wasm_bg.wasm.d.ts',
  'portable/asyncify-runtime.js',
  'portable/generation.json',
]
export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex')
async function files(path) {
  const entries = await readdir(resolve(root, path), { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? files(`${path}/${e.name}`) : [`${path}/${e.name}`],
    ),
  )
  return nested.flat()
}
export async function sourceIdentity() {
  const paths = [
    'Cargo.toml',
    'Cargo.lock',
    'rust-toolchain.toml',
    'crates/fretbloom-analysis/Cargo.toml',
    'crates/fretbloom-wasm/Cargo.toml',
    'scripts/wasm-bootstrap.mjs',
    'scripts/wasm-build.mjs',
    'scripts/wasm-jspi-adapter.mjs',
    'scripts/wasm-portable-adapter.mjs',
    'scripts/wasm-portable-types.mjs',
    'scripts/wasm-portable-metadata.mjs',
    'scripts/wasm-asyncify-bounds.mjs',
    'scripts/wasm-asyncify-runtime.mjs',
    'scripts/wasm-portable-build.mjs',
    'scripts/wasm-binaryen-tools.mjs',
    ...(await files('scripts/binaryen')),
    ...(await files('src/audio/live')),
    'src/audio/analysisV1.ts',
    'scripts/wasm-verify.mjs',
    ...(await files('crates/fretbloom-analysis/src')),
    ...(await files('crates/fretbloom-wasm/src')),
  ].sort()
  const sources = Object.fromEntries(
    await Promise.all(
      paths.map(async (p) => [p, sha256(await readFile(resolve(root, p)))]),
    ),
  )
  return { sourceHash: sha256(JSON.stringify({ tools, sources })), sources }
}
export async function verify(
  directory = resolve(root, 'src/generated/analysis-wasm'),
) {
  try {
    const manifest = JSON.parse(
      await readFile(resolve(directory, 'manifest.json'), 'utf8'),
    )
    const current = await sourceIdentity()
    if (
      manifest.schemaVersion !== 1 ||
      manifest.bridgeVersion !== 2 ||
      manifest.sourceHash !== current.sourceHash ||
      JSON.stringify(manifest.sources) !== JSON.stringify(current.sources) ||
      JSON.stringify(manifest.tools) !== JSON.stringify(tools)
    )
      throw new Error('source/tool association changed')
    for (const name of artifactNames)
      if (
        manifest.artifacts[name] !==
        sha256(await readFile(resolve(directory, name)))
      )
        throw new Error(`artifact hash changed: ${name}`)
    console.log(`WASM verified ${manifest.sourceHash}`)
    return manifest
  } catch (error) {
    throw new Error(
      `Missing or stale WASM artifacts (${error.message}). Run npm run wasm:bootstrap, then npm run wasm:build; include the regenerated artifact set.`,
    )
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await verify()
