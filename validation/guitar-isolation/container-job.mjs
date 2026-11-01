import { readFile, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const origin = 'http://127.0.0.1:53147/v1'
const json = async (path, init) => {
  const r = await fetch(origin + path, init)
  if (!r.ok) throw Error(`${r.status} ${await r.text()}`)
  return r.json()
}
let capabilities
for (let i = 0; i < 600; i++) {
  try {
    capabilities = await json('/capabilities')
    break
  } catch {}
  await new Promise((ok) => setTimeout(ok, 100))
}
if (!capabilities?.separation.available)
  throw Error('Offline non-root separator unavailable')
const data = await readFile('/input/six-minute.wav')
const start = performance.now()
const job = await json('/jobs', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    source: {
      kind: 'upload',
      name: 'six-minute.wav',
      contentType: 'audio/wav',
      byteLength: data.length,
    },
    focus: 'guitar',
  }),
})
const path = '/jobs/' + job.id
await json(path + '/media', { method: 'PUT', body: data })
let peakDiskBytes = 0
const stages = []
for (;;) {
  const j = await json(path)
  let diskBytes = 0
  for (const entry of await readdir('/tmp/guitar-jobs', {
    recursive: true,
    withFileTypes: true,
  })) {
    if (entry.isFile()) {
      try {
        diskBytes += (await stat(entry.parentPath + '/' + entry.name)).size
      } catch {}
    }
  }
  peakDiskBytes = Math.max(peakDiskBytes, diskBytes)
  stages.push({
    status: j.status,
    progress: j.progress,
    seconds: (performance.now() - start) / 1000,
  })
  if (j.status === 'succeeded') break
  if (j.error) throw Error(JSON.stringify(j))
  await new Promise((ok) => setTimeout(ok, 1000))
}
const result = await json(path + '/result')
if (
  result.analysis.duration !== 360 ||
  result.focus !== 'guitar' ||
  result.analyzedAudio.kind !== 'guitar_stem'
)
  throw Error('Incorrect real job result')
const preview = Buffer.from(
  await (await fetch(origin + path + '/guitar-audio')).arrayBuffer(),
)
if (preview.length !== 44 + 360 * 24000 * 2)
  throw Error('Preview alignment length')
console.log(
  JSON.stringify({
    passed: true,
    peakDiskBytes,
    uid: process.getuid(),
    capabilities,
    inputSha256: createHash('sha256').update(data).digest('hex'),
    wallSeconds: (performance.now() - start) / 1000,
    pcmSha256: result.pcmSha256,
    analyzedAudio: result.analyzedAudio,
    previewSha256: createHash('sha256').update(preview).digest('hex'),
    stages,
  }),
)
await json(path, { method: 'DELETE' })
