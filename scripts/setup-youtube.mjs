import { existsSync } from 'node:fs'
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const YT_DLP_VERSION = '2026.8.19'
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const environmentDirectory = join(projectRoot, '.tools', 'youtube')
const python =
  process.platform === 'win32'
    ? join(environmentDirectory, 'Scripts', 'python.exe')
    : join(environmentDirectory, 'bin', 'python')
const ytDlp =
  process.platform === 'win32'
    ? join(environmentDirectory, 'Scripts', 'yt-dlp.exe')
    : join(environmentDirectory, 'bin', 'yt-dlp')

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error && !allowFailure) throw result.error
  if (result.status !== 0 && !allowFailure) process.exit(result.status ?? 1)
  return !result.error && result.status === 0
}

await mkdir(dirname(environmentDirectory), { recursive: true })
if (!existsSync(python)) {
  const systemPython = process.env.PYTHON_PATH ?? 'python3'
  const createdVenv = run(systemPython, ['-m', 'venv', environmentDirectory], {
    allowFailure: true,
  })

  if (!createdVenv) {
    console.warn(
      'python venv is unavailable; using a project-local pip target instead.',
    )
    await rm(environmentDirectory, { recursive: true, force: true })
    const sitePackages = join(environmentDirectory, 'site-packages')
    await mkdir(dirname(ytDlp), { recursive: true })
    run(systemPython, [
      '-m',
      'pip',
      'install',
      '--disable-pip-version-check',
      '--upgrade',
      '--target',
      sitePackages,
      `yt-dlp[default]==${YT_DLP_VERSION}`,
    ])
    await writeFile(
      ytDlp,
      `#!/usr/bin/env python3\nimport sys\nfrom pathlib import Path\nsys.path.insert(0, str(Path(__file__).resolve().parents[1] / "site-packages"))\nfrom yt_dlp import main\nmain()\n`,
    )
    await chmod(ytDlp, 0o755)
  }
}

if (existsSync(python)) {
  run(python, [
    '-m',
    'pip',
    'install',
    '--disable-pip-version-check',
    '--upgrade',
    `yt-dlp[default]==${YT_DLP_VERSION}`,
  ])
}
run(ytDlp, ['--version'])

console.log(`yt-dlp ${YT_DLP_VERSION} is ready at ${ytDlp}`)
