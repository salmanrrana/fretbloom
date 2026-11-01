import { bootstrapBinaryen } from './wasm-binaryen-tools.mjs'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const cli = '.tools/wasm-bindgen-0.2.100'
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error || result.status !== 0) throw new Error(`${command} failed`)
}
await mkdir(`${root}/.tools`, { recursive: true })
run('rustup', [
  'toolchain',
  'install',
  '1.89.0',
  '--profile',
  'minimal',
  '--component',
  'rustfmt,clippy',
])
run('rustup', [
  'target',
  'add',
  '--toolchain',
  '1.89.0',
  'wasm32-unknown-unknown',
])
run('cargo', [
  '+1.89.0',
  'install',
  'wasm-bindgen-cli',
  '--version',
  '0.2.100',
  '--locked',
  '--root',
  cli,
])
run(`${root}/${cli}/bin/wasm-bindgen`, ['--version'])
await bootstrapBinaryen()
// Docker's tools-only stage has no workspace yet; its later build stage fetches.
if (existsSync(new URL('../Cargo.toml', import.meta.url))) {
  run('cargo', [
    '+1.89.0',
    'fetch',
    '--locked',
    '--target',
    'wasm32-unknown-unknown',
  ])
}
console.log(
  'Pinned WASM tools ready. Run npm run wasm:build with Node 24.22.2.',
)
