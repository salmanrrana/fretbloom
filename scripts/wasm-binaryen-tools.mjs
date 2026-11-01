/** Official Binaryen125 archive/checksum and tool/license identity. */
import { readFile, lstat, mkdir, writeFile, rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
const root = fileURLToPath(new URL('../', import.meta.url))
export const binaryenPin = JSON.parse(
  await readFile(new URL('./binaryen/pin.json', import.meta.url), 'utf8'),
)
export const binaryenTools = {
  'wasm-opt':
    '23c1f4106e34eeaf44e888f947671f04d0fec12c232cca19cc5c4b3cf7c96f08',
  'wasm-as': '2ed055301944046877b213de2654b83fdf0f23535db055577de57783dfb08d96',
  'wasm-dis':
    '4bb00b903007a7893b69af0d65a9a46a9ff52b9823564f312228778deee7c51b',
  // Exact executable bytes from the retained official version_125 archive.
}
export const binaryenPath = (name) =>
  resolve(root, '.tools/binaryen-version_125/bin', name)
const hash = (b) => createHash('sha256').update(b).digest('hex')
export async function verifyBinaryen() {
  const archive = await readFile(resolve(root, '.tools/binaryen-125.tar.gz'))
  if (hash(archive) !== binaryenPin.sha256)
    throw Error('Binaryen archive checksum mismatch')
  const checksum = await readFile(
    resolve(root, '.tools/binaryen-125.tar.gz.sha256'),
    'utf8',
  )
  if (checksum.trim().split(/\s+/)[0] !== binaryenPin.sha256)
    throw Error('Official checksum mismatch')
  for (const name of ['wasm-opt', 'wasm-as', 'wasm-dis']) {
    if (
      !binaryenTools[name] ||
      hash(await readFile(binaryenPath(name))) !== binaryenTools[name]
    )
      throw Error(`Binaryen tool hash mismatch: ${name}`)
  }
}
export async function bootstrapBinaryen() {
  const toolDirectory = resolve(root, '.tools/binaryen-version_125')
  let existing = false
  try {
    await lstat(toolDirectory)
    existing = true
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (existing) {
    await verifyBinaryen()
    return
  }
  await mkdir(resolve(root, '.tools'), { recursive: true })
  for (const [url, filename] of [
    [binaryenPin.url, 'binaryen-125.tar.gz'],
    [binaryenPin.checksumURL, 'binaryen-125.tar.gz.sha256'],
  ]) {
    const response = await fetch(url)
    if (!response.ok)
      throw Error(`Binaryen download failed: ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (filename.endsWith('.tar.gz') && hash(bytes) !== binaryenPin.sha256)
      throw Error('Binaryen archive checksum mismatch')
    if (
      filename.endsWith('.sha256') &&
      bytes.toString().trim().split(/\s+/)[0] !== binaryenPin.sha256
    )
      throw Error('Binaryen official checksum mismatch')
    const path = resolve(root, '.tools', filename)
    await writeFile(path + '.tmp', bytes)
    await rename(path + '.tmp', path)
  }
  const result = spawnSync(
    'tar',
    [
      '-xzf',
      resolve(root, '.tools/binaryen-125.tar.gz'),
      '-C',
      resolve(root, '.tools'),
    ],
    { stdio: 'inherit' },
  )
  if (result.error || result.status !== 0) {
    await rm(resolve(root, '.tools/binaryen-version_125'), {
      recursive: true,
      force: true,
    })
    throw Error('Binaryen extraction failed')
  }
  await verifyBinaryen()
}
