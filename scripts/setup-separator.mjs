/** Install only project-local, hash-locked CPU inference tooling and verified weights. */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = resolve(root, '.tools/separator')
const python = resolve(dir, 'bin/python')
const system = process.env.PYTHON_PATH ?? '/usr/bin/python3'
const env = {
  PATH: process.env.PATH ?? '/usr/bin:/bin',
  HOME: process.env.HOME ?? '/tmp',
}
function run(command, args, allowFailure = false) {
  const r = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' })
  if (!allowFailure && (r.error || r.status !== 0))
    throw new Error(`Separator setup failed: ${command} (exit ${r.status})`)
  return !r.error && r.status === 0
}
await mkdir(dir, { recursive: true })
if (!existsSync(python)) {
  if (!run(system, ['-m', 'venv', dir], true))
    run(system, ['-m', 'venv', '--without-pip', dir])
}
const pipArgs = [
  'install',
  '--disable-pip-version-check',
  '--no-cache-dir',
  '--no-deps',
  '--only-binary=:all:',
  '--require-hashes',
  '-r',
  resolve(root, 'scripts/separator-requirements.lock'),
]
if (run(python, ['-m', 'pip', '--version'], true))
  run(python, ['-m', 'pip', ...pipArgs])
else run(system, ['-m', 'pip', '--python', python, ...pipArgs])
const weights = resolve(dir, '5c90dfd2-34c22ccb.th')
const sha = '34c22ccb381c6f9fdbf324f04e1e2fe21aaaf293f5ded163a162697ff9a02ddd'
const valid = async () =>
  existsSync(weights) &&
  createHash('sha256')
    .update(await readFile(weights))
    .digest('hex') === sha
if (!(await valid())) {
  const response = await fetch(
    'https://dl.fbaipublicfiles.com/demucs/hybrid_transformer/5c90dfd2-34c22ccb.th',
    { signal: AbortSignal.timeout(120_000) },
  )
  if (!response.ok)
    throw new Error(`Weights download failed: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (
    bytes.length !== 54_996_327 ||
    createHash('sha256').update(bytes).digest('hex') !== sha
  )
    throw new Error('Weights SHA256 mismatch')
  await writeFile(`${weights}.download`, bytes)
  await rename(`${weights}.download`, weights)
}
run(python, [
  '-I',
  '-B',
  resolve(root, 'scripts/separate-guitar.py'),
  '--weights',
  weights,
  '--check',
])
console.log(`Offline CPU guitar separator ready at ${dir}`)
