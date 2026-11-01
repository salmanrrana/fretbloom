import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, it } from 'vitest'

declare global {
  interface Window {
    listeningStorage: typeof import('../data/listeningSessions')
    liveRuntimeModule: typeof import('../audio/live/runtime')
    failLocalStopReply: boolean
  }
}

// Run only with a verified local build/dev URL. These tests use a fresh, isolated browser profile.
describe.skipIf(!process.env.LIVE_BROWSER_URL)(
  'real browser local listening',
  () => {
    it('saves audio atomically, reloads, renames, detects corruption, and deletes in actual IndexedDB', async () => {
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        await page.routeWebSocket('**/*', (socket) => socket.close())
        await page.goto(`${process.env.LIVE_BROWSER_URL}/listen`, {
          waitUntil: 'domcontentloaded',
        })
        await page.locator('.live-listen').waitFor()
        await page.addScriptTag({
          type: 'module',
          content:
            "import * as storage from '/src/data/listeningSessions.ts'; window.listeningStorage = storage;",
        })
        await page.waitForFunction(() => !!window.listeningStorage)
        const result = await page.evaluate(async () => {
          const storage = window.listeningStorage
          await storage.clearListeningSessions()
          const samples = new Float32Array(24000)
          const pcm = new Blob([samples.buffer])
          const hash = Array.from(
            new Uint8Array(
              await crypto.subtle.digest('SHA-256', samples.buffer),
            ),
            (byte) => byte.toString(16).padStart(2, '0'),
          ).join('')
          const session: import('../data/listeningSessions').SavedListeningSession =
            {
              schemaVersion: 1,
              id: crypto.randomUUID(),
              title: 'Before transaction',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              source: 'tab',
              anchors: [],
              captureWarnings: [],
              analysis: {
                schemaVersion: 1,
                engineVersion: 'storage-test-only',
                options: { mode: 'auto', concertAHz: 440, spelling: 'sharps' },
                durationSamples: 24000,
                segments: [
                  {
                    id: 0,
                    startSample: 0,
                    endSample: 24000,
                    sourceRateHz: 48000,
                    channel: 'mean',
                    precedingGap: null,
                  },
                ],
                results: [],
                completeness: 'partial',
              },
              pcm: {
                byteLength: pcm.size,
                sha256: hash,
                sampleRateHz: 24000,
                format: 'f32le',
              },
            }
          await storage.saveListeningSession(session, pcm)
          const initial = (await storage.listListeningSessions())[0]
          const loadedBytes = (await storage.loadListeningPcm(initial))?.size
          // Controlled quota failure AFTER the metadata put, before the PCM put.
          const put = IDBObjectStore.prototype.put
          IDBObjectStore.prototype.put = function (
            ...args: Parameters<typeof put>
          ) {
            if (this.name === 'pcm')
              throw new DOMException(
                'Injected quota failure',
                'QuotaExceededError',
              )
            return put.apply(this, args)
          }
          let quota = ''
          try {
            await storage.saveListeningSession(
              { ...session, title: 'Must not replace old save' },
              pcm,
            )
          } catch (error) {
            quota = error instanceof Error ? error.message : ''
          } finally {
            IDBObjectStore.prototype.put = put
          }
          const afterFailed = (await storage.listListeningSessions())[0]
          const bytesAfterFailure = (
            await storage.loadListeningPcm(afterFailed)
          )?.size
          let corruptReplacement = ''
          try {
            await storage.saveListeningSession(
              { ...session, title: 'Corrupt replacement' },
              new Blob([new Float32Array(24000).fill(0.25)]),
            )
          } catch (error) {
            corruptReplacement = error instanceof Error ? error.message : ''
          }
          const afterCorrupt = (await storage.listListeningSessions())[0]
          const oldAudioAfterCorrupt = (
            await storage.loadListeningPcm(afterCorrupt)
          )?.size
          await storage.renameListeningSession(session.id, 'Renamed in browser')
          const renamed = (await storage.listListeningSessions())[0].title
          await storage.saveListeningSession({ ...session, pcm: null }, null)
          const metadataOnly = (await storage.listListeningSessions())[0]
          const noAudio = await storage.loadListeningPcm(metadataOnly)
          for (let i = 1; i < 20; i++)
            await storage.saveListeningSession(
              { ...session, pcm: null, id: crypto.randomUUID() },
              null,
            )
          let cap = ''
          try {
            await storage.saveListeningSession(
              { ...session, pcm: null, id: crypto.randomUUID() },
              null,
            )
          } catch (error) {
            cap = error instanceof Error ? error.message : ''
          }
          await storage.clearListeningSessions()
          await storage.saveListeningSession(session, pcm)
          const db = await new Promise<IDBDatabase>((resolve) => {
            const req = indexedDB.open(storage.LISTENING_DB, 1)
            req.onsuccess = () => resolve(req.result)
          })
          const tx = db.transaction('pcm', 'readwrite')
          tx.objectStore('pcm').put(
            new Blob([new Float32Array(24000).fill(0.5)]),
            session.id,
          )
          await new Promise<void>((resolve) => {
            tx.oncomplete = () => resolve()
          })
          db.close()
          let corruption = ''
          try {
            await storage.loadListeningPcm(session)
          } catch (error) {
            corruption = error instanceof Error ? error.message : ''
          }
          await storage.deleteListeningSession(session.id)
          return {
            initialTitle: initial.title,
            loadedBytes,
            quota,
            afterFailedTitle: afterFailed.title,
            bytesAfterFailure,
            renamed,
            corruptReplacement,
            afterCorruptTitle: afterCorrupt.title,
            oldAudioAfterCorrupt,
            noAudio,
            cap,
            corruption,
            countAfterDelete: (await storage.listListeningSessions()).length,
            localKeys: Object.keys(localStorage),
          }
        })
        expect(result).toMatchObject({
          initialTitle: 'Before transaction',
          loadedBytes: 96000,
          afterFailedTitle: 'Before transaction',
          bytesAfterFailure: 96000,
          renamed: 'Renamed in browser',
          noAudio: null,
          countAfterDelete: 0,
          localKeys: [],
        })
        expect(result.corruptReplacement).toContain('integrity')
        expect(result.afterCorruptTitle).toBe('Before transaction')
        expect(result.oldAudioAfterCorrupt).toBe(96000)
        expect(result.quota).toContain('full')
        expect(result.cap).toContain('20 sessions')
        expect(result.corruption).toContain('integrity')
        await page.reload()
        await expect(
          page.getByText('No sessions saved yet.').count(),
        ).resolves.toBe(1)
      } finally {
        await browser.close()
      }
    }, 60000)
    it('captures an actual fake-device microphone through the worklet/WASM before Stop, then refines, saves, reloads and plays', async () => {
      const folder = await mkdtemp(join(tmpdir(), 'fretbloom-u-'))
      const file = join(folder, 'independent-tones.wav')
      const rate = 48000
      const count = rate * 6
      const wav = Buffer.alloc(44 + count * 2)
      wav.write('RIFF')
      wav.writeUInt32LE(36 + count * 2, 4)
      wav.write('WAVEfmt ', 8)
      wav.writeUInt32LE(16, 16)
      wav.writeUInt16LE(1, 20)
      wav.writeUInt16LE(1, 22)
      wav.writeUInt32LE(rate, 24)
      wav.writeUInt32LE(rate * 2, 28)
      wav.writeUInt16LE(2, 32)
      wav.writeUInt16LE(16, 34)
      wav.write('data', 36)
      wav.writeUInt32LE(count * 2, 40)
      for (let i = 0; i < count; i++) {
        const frequency = i < rate * 3 ? 220 : 329.627557
        wav.writeInt16LE(
          Math.round(
            (Math.sin((i / rate) * Math.PI * 2 * frequency) * 0.3 +
              Math.sin((i / rate) * Math.PI * 4 * frequency) * 0.08) *
              32767,
          ),
          44 + i * 2,
        )
      }
      await writeFile(file, wav)
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          `--use-file-for-fake-audio-capture=${file}`,
        ],
      })
      try {
        const context = await browser.newContext({
          permissions: ['microphone'],
          viewport: { width: 1280, height: 1000 },
        })
        const page = await context.newPage()
        await page.addInitScript(`
          window.failLocalStopReply = false;
          const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
          Object.defineProperty(Worker.prototype, 'onmessage', {
            configurable: true, get: descriptor.get,
            set(handler) {
              descriptor.set.call(this, typeof handler !== 'function' ? handler : function(event) {
                const data = event.data;
                if (window.failLocalStopReply && data && data.type === 'reply' && data.value && Array.isArray(data.value.segments) && typeof data.value.durationSamples === 'number') {
                  window.failLocalStopReply = false;
                  data.value.schemaVersion = 99;
                }
                handler.call(this, event);
              });
            }
          });
        `)
        await page.routeWebSocket('**/*', (socket) => socket.close())
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        const uploads: string[] = []
        page.on('request', (req) => {
          if (req.method() !== 'GET' && req.method() !== 'HEAD')
            uploads.push(req.url())
        })
        await page.goto(`${process.env.LIVE_BROWSER_URL}/listen`, {
          waitUntil: 'domcontentloaded',
        })
        await page
          .getByRole('radio', { name: 'Microphone / interface' })
          .check()
        const start = page.getByRole('button', {
          name: 'Start capture',
          exact: true,
        })
        await start.waitFor({ state: 'visible', timeout: 30000 })
        await start.click()
        await page
          .getByRole('button', { name: 'Stop capture', exact: true })
          .waitFor()
        await page.waitForFunction(
          () => document.querySelectorAll('.live-event').length > 0,
          { timeout: 20000 },
        )
        const beforeStop = await page.locator('.live-event').count()
        await page.getByRole('button', { name: 'Pause', exact: true }).click()
        const resumePositions = page.evaluate(async () => {
          const observations: {
            y: number | null
            status: string
            error: string
          }[] = []
          for (let i = 0; i < 40; i++) {
            const button = Array.from(document.querySelectorAll('button')).find(
              (node) => node.textContent === 'Resume capture',
            )
            observations.push({
              y: button?.getBoundingClientRect().y ?? null,
              status: document.querySelector('.live-status')?.textContent ?? '',
              error: document.querySelector('.live-error')?.textContent ?? '',
            })
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            )
          }
          return observations
        })
        try {
          await page
            .getByRole('button', { name: 'Resume capture' })
            .click({ timeout: 5000 })
        } catch (error) {
          await writeFile(
            join(folder, 'resume-positions.json'),
            JSON.stringify(await resumePositions, null, 2),
          )
          await writeFile(
            join(folder, 'resume-failure.txt'),
            await page.locator('body').innerText(),
          )
          throw error
        }
        await page
          .getByRole('button', { name: 'Stop capture', exact: true })
          .click()
        await page
          .getByRole('button', { name: 'Refine recording' })
          .waitFor({ state: 'visible', timeout: 15000 })
        await page.getByRole('button', { name: 'Refine recording' }).click()
        await page.waitForFunction(
          () =>
            /Refinement (complete|failed)/.test(
              document.querySelector('.live-status')?.textContent ?? '',
            ),
          null,
          { timeout: 120000 },
        )
        expect(
          await page.locator('.live-status').textContent(),
          (await page.locator('.live-error').allTextContents()).join('\n'),
        ).toContain('Refinement complete')
        await page.getByRole('button', { name: 'Play captured audio' }).click()
        await page.locator('audio').waitFor()
        const playback = await page.locator('audio').evaluate(async (audio) => {
          if (!(audio instanceof HTMLAudioElement))
            throw new Error('Missing audio element')
          await audio.play()
          return audio.currentSrc.startsWith('blob:')
        })
        await page.getByLabel('Keep audio for playback and refinement').check()
        await page
          .getByRole('button', { name: 'Save on this browser', exact: true })
          .click()
        await page
          .getByRole('button', { name: 'Saved on this browser', exact: true })
          .waitFor()
        const savedName = await page
          .locator('.live-sessions strong')
          .first()
          .textContent()
        await page.screenshot({
          path: join(folder, 'desktop.png'),
          fullPage: true,
        })
        await page.setViewportSize({ width: 360, height: 900 })
        await page.screenshot({
          path: join(folder, 'narrow.png'),
          fullPage: true,
        })
        const narrowOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
        const audioBufferReadout = await page
          .locator('.live-diagnostics')
          .textContent()
        const uiAudioBytes = Number(
          await page
            .locator('.live-diagnostics')
            .getAttribute('data-ui-audio-bytes'),
        )
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: 'Open', exact: true }).click()
        await page
          .getByRole('status')
          .filter({ hasText: 'verified audio opened' })
          .waitFor({ timeout: 30000 })
        await page.getByRole('button', { name: 'Play captured audio' }).click()
        await page.locator('audio').waitFor()
        await page.getByRole('button', { name: 'Delete', exact: true }).click()
        await page
          .getByRole('button', { name: 'Delete this session', exact: true })
          .click()
        await page.getByText('No sessions saved yet.').waitFor()
        // Controlled invalid Stop metadata: ingestion retains genuine captured PCM.
        await page
          .getByRole('button', { name: 'Discard current / new capture' })
          .click()
        await page
          .getByRole('button', { name: 'Start capture', exact: true })
          .click()
        await page.waitForFunction(
          () => document.querySelectorAll('.live-event').length > 0,
        )
        await page.evaluate(() => {
          window.failLocalStopReply = true
        })
        await page
          .getByRole('button', { name: 'Stop capture', exact: true })
          .click()
        await page
          .getByRole('region', { name: 'Recover retained capture' })
          .waitFor()
        expect(
          await page
            .getByRole('button', { name: 'Save on this browser', exact: true })
            .count(),
        ).toBe(0)
        await page.getByRole('button', { name: 'Play captured audio' }).click()
        await page.locator('audio').waitFor()
        await page
          .getByRole('button', { name: 'Refine recording', exact: true })
          .click()
        await page.waitForFunction(() =>
          /Refinement (complete|failed)/.test(
            document.querySelector('.live-status')?.textContent ?? '',
          ),
        )
        expect(
          await page.locator('.live-status').textContent(),
          (await page.locator('.live-error').allTextContents()).join('\n'),
        ).toContain('Refinement complete')
        expect(beforeStop).toBeGreaterThan(0)
        expect(playback).toBe(true)
        expect(savedName).toBe('Untitled capture')
        expect(narrowOverflow).toBe(false)
        expect(errors).toEqual([])
        expect(uploads).toEqual([])
        await writeFile(
          join(folder, 'evidence.json'),
          JSON.stringify(
            {
              browser: browser.version(),
              beforeStop,
              playback,
              narrowOverflow,
              errors,
              uploads,
              screenshots: folder,
              audioBufferReadout,
              uiAudioBytes,
            },
            null,
            2,
          ),
        )
      } finally {
        await browser.close()
        await rm(file, { force: true })
      }
    }, 180000)

    it('requires explicit old-engine reanalysis and preserves prior displayed/saved evidence on failure and cancellation', async () => {
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        await page.routeWebSocket('**/*', (socket) => socket.close())
        await page.goto(`${process.env.LIVE_BROWSER_URL}/listen`, {
          waitUntil: 'domcontentloaded',
        })
        await page.locator('.live-listen').waitFor()
        await page.addScriptTag({
          type: 'module',
          content:
            "import * as storage from '/src/data/listeningSessions.ts'; window.listeningStorage = storage;",
        })
        await page.waitForFunction(() => !!window.listeningStorage)
        await page.evaluate(async () => {
          const storage = window.listeningStorage
          const samples = new Float32Array(48000)
          for (let i = 0; i < samples.length; i++)
            samples[i] = Math.sin((i / 24000) * Math.PI * 2 * 220) * 0.3
          const sha256 = Array.from(
            new Uint8Array(
              await crypto.subtle.digest('SHA-256', samples.buffer),
            ),
            (byte) => byte.toString(16).padStart(2, '0'),
          ).join('')
          await storage.saveListeningSession(
            {
              schemaVersion: 1,
              id: crypto.randomUUID(),
              title: 'Older engine passage',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              source: 'tab',
              anchors: [],
              captureWarnings: [],
              analysis: {
                schemaVersion: 1,
                engineVersion: 'legacy-test-engine',
                options: { mode: 'auto', concertAHz: 440, spelling: 'sharps' },
                durationSamples: samples.length,
                segments: [
                  {
                    id: 0,
                    startSample: 0,
                    endSample: samples.length,
                    sourceRateHz: 24000,
                    channel: 'mean',
                    precedingGap: null,
                  },
                ],
                results: [],
                completeness: 'partial',
              },
              pcm: {
                sha256,
                byteLength: samples.byteLength,
                sampleRateHz: 24000,
                format: 'f32le',
              },
            },
            new Blob([samples.buffer]),
          )
        })
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: 'Open', exact: true }).click()
        const reanalyze = page.getByRole('button', {
          name: 'Reanalyze with current engine',
        })
        await reanalyze.waitFor()
        await page.waitForFunction(() => {
          const button = Array.from(document.querySelectorAll('button')).find(
            (node) => node.textContent === 'Reanalyze with current engine',
          )
          return button && !button.disabled
        })
        // Controlled transport failure: no detector result is mocked.
        await page.evaluate(() => {
          const original = Worker.prototype.postMessage
          Worker.prototype.postMessage = function (
            message: unknown,
            options?: StructuredSerializeOptions | Transferable[],
          ) {
            if (
              message &&
              typeof message === 'object' &&
              'type' in message &&
              message.type === 'restore'
            ) {
              Worker.prototype.postMessage = original
              throw new Error('Controlled restore transport failure')
            }
            return original.call(
              this,
              message,
              Array.isArray(options) ? { transfer: options } : (options ?? {}),
            )
          }
        })
        await reanalyze.click()
        await page
          .getByRole('status')
          .filter({ hasText: 'Refinement failed' })
          .waitFor()
        expect(await page.locator('.live-results').innerText()).toContain(
          'legacy-test-engine',
        )
        // Hold one genuine restore reply so this case exercises cancellation during
        // restore, rather than racing a two-second recording's fast completion.
        // Busy synchronous-DSP cancellation is a separate independent test gate.
        await page.evaluate(`{
          const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
          const post = Worker.prototype.postMessage;
          const restores = new WeakMap();
          Worker.prototype.postMessage = function(message, options) {
            if (message && message.type === 'restore') restores.set(this, message.requestId);
            return post.call(this, message, options);
          };
          Object.defineProperty(Worker.prototype, 'onmessage', {
            configurable: true, get: descriptor.get,
            set(handler) {
              descriptor.set.call(this, typeof handler !== 'function' ? handler : function(event) {
                if (event.data && event.data.type === 'reply' && event.data.requestId === restores.get(this)) {
                  window.heldRestoreReply = true;
                  return;
                }
                handler.call(this, event);
              });
            }
          });
          window.restoreReplyGate = () => {
            Worker.prototype.postMessage = post;
            Object.defineProperty(Worker.prototype, 'onmessage', descriptor);
          };
        }`)
        await reanalyze.click()
        await page.waitForFunction('window.heldRestoreReply === true')
        await page.getByRole('button', { name: 'Cancel refinement' }).click()
        await page.evaluate('window.restoreReplyGate()')
        await page
          .getByRole('status')
          .filter({ hasText: 'Refinement canceled' })
          .waitFor()
        expect(await page.locator('.live-results').innerText()).toContain(
          'legacy-test-engine',
        )
        await page.addScriptTag({
          type: 'module',
          content:
            "import * as storage from '/src/data/listeningSessions.ts'; window.listeningStorage = storage;",
        })
        await page.waitForFunction(() => !!window.listeningStorage)
        expect(
          await page.evaluate(
            async () =>
              (await window.listeningStorage.listListeningSessions())[0]
                .analysis.engineVersion,
          ),
        ).toBe('legacy-test-engine')
        await page
          .locator('.live-results button:not(:disabled)')
          .filter({
            hasText: /^(Refine recording|Reanalyze with current engine)$/,
          })
          .first()
          .click()
        await page.waitForFunction(
          () =>
            /Refinement (complete|failed)/.test(
              document.querySelector('.live-status')?.textContent ?? '',
            ),
          null,
          { timeout: 120000 },
        )
        expect(
          await page.locator('.live-status').textContent(),
          (await page.locator('.live-error').allTextContents()).join('\n'),
        ).toContain('Refinement complete')
        expect(await page.locator('.live-results').innerText()).toContain(
          'rust-dsp-2',
        )
        expect(
          await page.evaluate(
            async () =>
              (await window.listeningStorage.listListeningSessions())[0]
                .analysis.engineVersion,
          ),
        ).toBe('legacy-test-engine')
        await page
          .getByRole('button', { name: 'Save on this browser', exact: true })
          .click()
        await page
          .getByRole('button', { name: 'Saved on this browser', exact: true })
          .waitFor()
        expect(
          await page.evaluate(
            async () =>
              (await window.listeningStorage.listListeningSessions())[0]
                .analysis.engineVersion,
          ),
        ).toBe('rust-dsp-2')
      } finally {
        await browser.close()
      }
    }, 150000)
  },
)
it.skipIf(!process.env.LIVE_BROWSER_URL)(
  'stops and refines exact off-grid canonical PCM through real browser ingestion and WASM',
  async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.routeWebSocket('**/*', (socket) => socket.close())
      await page.goto(`${process.env.LIVE_BROWSER_URL}/listen`, {
        waitUntil: 'domcontentloaded',
      })
      await page.locator('.live-listen').waitFor()
      await page.addScriptTag({
        type: 'module',
        content:
          "import * as runtime from '/src/audio/live/runtime.ts'; window.liveRuntimeModule = runtime;",
      })
      await page.waitForFunction(() => !!window.liveRuntimeModule)
      const results = await page.evaluate(async () => {
        const output: {
          samples: number
          stopped: number
          refined: number
          engine: string
          maxFeatureTime: number
          duration: number
        }[] = []
        for (const samples of [65536, 61696]) {
          const engine = window.liveRuntimeModule.createLiveRuntime(() => {})
          const key = { sessionId: crypto.randomUUID(), generation: 1 }
          const ports = new MessageChannel()
          try {
            await engine.prepare(key, {
              mode: 'auto',
              concertAHz: 440,
              spelling: 'sharps',
            })
            engine.attachCapturePort(ports.port2, { channel: 'left' })
            let credit: (() => void) | null = null
            let ended: (() => void) | null = null
            ports.port1.onmessage = (event: MessageEvent<unknown>) => {
              const data = event.data
              if (!data || typeof data !== 'object' || !('type' in data)) return
              if (data.type === 'credit') credit?.()
              if (
                data.type === 'boundary_ack' &&
                'action' in data &&
                data.action === 'end'
              )
                ended?.()
            }
            ports.port1.start()
            let sequence = 0
            for (let frame = 0; frame < samples; frame += 2048) {
              const count = Math.min(2048, samples - frame)
              const pcm = new Float32Array(count)
              for (let i = 0; i < count; i++)
                pcm[i] =
                  Math.sin(((frame + i) / 24000) * Math.PI * 2 * 220) * 0.3
              const acknowledged = new Promise<void>((resolve) => {
                credit = resolve
              })
              ports.port1.postMessage(
                {
                  ...key,
                  type: 'pcm',
                  sequence: sequence++,
                  firstFrame: frame,
                  frameCount: count,
                  sampleRateHz: 24000,
                  channels: 1,
                  interleaved: pcm.buffer,
                },
                [pcm.buffer],
              )
              await acknowledged
            }
            const barrier = new Promise<void>((resolve) => {
              ended = resolve
            })
            ports.port1.postMessage({
              ...key,
              type: 'boundary',
              sequence,
              frame: samples,
              action: 'end',
              reason: 'user_stop',
            })
            await barrier
            const stopped = await engine.stop()
            const refined = await engine.refine(new AbortController().signal)
            const maxFeatureTime = Math.max(
              0,
              ...refined.results.flatMap((segment) =>
                segment.features.frames.map((frame) => frame.time),
              ),
            )
            output.push({
              samples,
              stopped: stopped.durationSamples,
              refined: refined.durationSamples,
              engine: refined.engineVersion,
              maxFeatureTime,
              duration: samples / 24000,
            })
          } finally {
            ports.port1.close()
            engine.dispose()
          }
        }
        return output
      })
      for (const result of results) {
        expect(result.stopped).toBe(result.samples)
        expect(result.refined).toBe(result.samples)
        expect(result.maxFeatureTime).toBeLessThanOrEqual(result.duration)
      }
    } finally {
      await browser.close()
    }
  },
  90000,
)

it.skipIf(!process.env.LIVE_BROWSER_URL)(
  'saves a real 300-second PCM after playback, releases WAV before worker verification, and rebuilds playback',
  async () => {
    const browser = await chromium.launch({ headless: true })
    const folder = await mkdtemp(join(tmpdir(), 'fretbloom-save-fixes-'))
    try {
      const page = await browser.newPage()
      await page.addInitScript(() => {
        const observations: {
          kind: string
          bytes: number
          at: number
          worker?: string
        }[] = []
        Object.defineProperty(window, 'pcmObservations', {
          value: observations,
        })
        const NativeBuffer = ArrayBuffer
        window.ArrayBuffer = class extends NativeBuffer {
          static [Symbol.hasInstance](value: unknown) {
            return value instanceof NativeBuffer
          }
          constructor(length = 0) {
            super(length)
            observations.push({
              kind: 'main-buffer',
              bytes: this.byteLength,
              at: performance.now(),
            })
          }
        }
        const NativeBlob = Blob
        window.Blob = class extends NativeBlob {
          static [Symbol.hasInstance](value: unknown) {
            return value instanceof NativeBlob
          }
          constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
            super(parts, options)
            if (options?.type === 'audio/wav')
              observations.push({
                kind: 'wav-blob',
                bytes: this.size,
                at: performance.now(),
              })
          }
        }
        const originalRead = Blob.prototype.arrayBuffer
        Blob.prototype.arrayBuffer = function () {
          observations.push({
            kind: 'main-read',
            bytes: this.size,
            at: performance.now(),
          })
          return originalRead.call(this)
        }
        const NativeWorker = Worker
        window.Worker = class extends NativeWorker {
          constructor(url: string | URL, options?: WorkerOptions) {
            const entry = new URL(url, location.href).href
            const instrumentation = `
            const read = Blob.prototype.arrayBuffer;
            Blob.prototype.arrayBuffer = function() {
              self.postMessage({ pcmAllocationProbe: true, bytes: this.size });
              return read.call(this);
            };
            const waiting = [];
            self.onmessage = event => waiting.push(event);
            await import(${JSON.stringify(entry)});
            for (const event of waiting) self.dispatchEvent(new MessageEvent('message', { data: event.data, ports: event.ports }));
          `
            const loader = URL.createObjectURL(
              new Blob([instrumentation], { type: 'text/javascript' }),
            )
            super(loader, options)
            URL.revokeObjectURL(loader)
            observations.push({
              kind: 'worker-start',
              worker: entry,
              bytes: 0,
              at: performance.now(),
            })
            this.addEventListener('message', (event) => {
              const value: unknown = event.data
              if (
                value &&
                typeof value === 'object' &&
                'pcmAllocationProbe' in value &&
                value.pcmAllocationProbe === true &&
                'bytes' in value &&
                typeof value.bytes === 'number'
              ) {
                observations.push({
                  kind: 'worker-read',
                  bytes: value.bytes,
                  worker: entry,
                  at: performance.now(),
                })
                event.stopImmediatePropagation()
              }
            })
            const terminate = this.terminate.bind(this)
            this.terminate = () => {
              observations.push({
                kind: 'worker-stop',
                worker: entry,
                bytes: 0,
                at: performance.now(),
              })
              terminate()
            }
          }
        }
        const wavUrls = new Set<string>()
        const createUrl = URL.createObjectURL
        URL.createObjectURL = function (blob: Blob | MediaSource) {
          const url = createUrl.call(this, blob)
          if (blob instanceof Blob && blob.type === 'audio/wav')
            wavUrls.add(url)
          return url
        }
        const revoke = URL.revokeObjectURL
        URL.revokeObjectURL = function (url: string) {
          observations.push({
            kind: wavUrls.has(url) ? 'wav-url-revoke' : 'url-revoke',
            bytes: 0,
            at: performance.now(),
          })
          revoke.call(this, url)
        }
      })
      await page.routeWebSocket('**/*', (socket) => socket.close())
      await page.goto(`${process.env.LIVE_BROWSER_URL}/listen`, {
        waitUntil: 'domcontentloaded',
      })
      await page.locator('.live-listen').waitFor()
      await page.addScriptTag({
        type: 'module',
        content:
          "import * as storage from '/src/data/listeningSessions.ts'; window.listeningStorage = storage;",
      })
      await page.waitForFunction(() => !!window.listeningStorage)
      // Controlled 300-second polyphonic PCM storage fixture, not paced capture or musical scoring.
      await page.evaluate(async () => {
        const samples = new Float32Array(7200000)
        for (let i = 0; i < samples.length; i++)
          samples[i] = [110, 138.59, 164.81].reduce(
            (sum, hz) => sum + Math.sin((i / 24000) * Math.PI * 2 * hz) * 0.1,
            0,
          )
        const sha256 = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', samples.buffer)),
          (b) => b.toString(16).padStart(2, '0'),
        ).join('')
        await window.listeningStorage.saveListeningSession(
          {
            schemaVersion: 1,
            id: crypto.randomUUID(),
            title: '300 second save-after-playback',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            source: 'tab',
            anchors: [],
            captureWarnings: [],
            analysis: {
              schemaVersion: 1,
              engineVersion: 'rust-dsp-2',
              options: { mode: 'auto', concertAHz: 440, spelling: 'sharps' },
              durationSamples: samples.length,
              segments: [
                {
                  id: 0,
                  startSample: 0,
                  endSample: samples.length,
                  sourceRateHz: 24000,
                  channel: 'mean',
                  precedingGap: null,
                },
              ],
              results: [],
              completeness: 'partial',
            },
            pcm: {
              sha256,
              byteLength: samples.byteLength,
              sampleRateHz: 24000,
              format: 'f32le',
            },
          },
          new Blob([samples.buffer]),
        )
      })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: 'Open', exact: true }).click()
      await page
        .getByRole('status')
        .filter({ hasText: 'verified audio opened' })
        .waitFor({ timeout: 30000 })
      const baseline = await page
        .locator('.live-diagnostics')
        .evaluate((node) => {
          const observations: {
            values: Record<string, string | null>
            at: number
          }[] = []
          Object.defineProperty(window, 'pcmCounterObservations', {
            value: observations,
          })
          const record = () =>
            observations.push({
              at: performance.now(),
              values: Object.fromEntries(
                [
                  'data-owned-audio-bytes',
                  'data-runtime-js-bytes',
                  'data-pcm-bytes',
                  'data-shared-pcm-bytes',
                  'data-playback-bytes',
                  'data-verification-bytes',
                ].map((key) => [key, node.getAttribute(key)]),
              ),
            })
          record()
          new MutationObserver(record).observe(node, { attributes: true })
          return node.getAttribute('data-owned-audio-bytes')
        })
      expect(Number(baseline)).toBeGreaterThan(57600000)
      await page
        .getByRole('button', { name: 'Play captured audio', exact: true })
        .click()
      await page.locator('audio').waitFor()
      expect(
        Number(
          await page
            .locator('.live-diagnostics')
            .getAttribute('data-playback-bytes'),
        ),
      ).toBe(14400044)
      await page
        .getByLabel('Session name')
        .fill('Saved after prepared playback')
      await page
        .getByRole('button', { name: 'Save on this browser', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Saved on this browser', exact: true })
        .waitFor({ timeout: 30000 })
      expect(await page.locator('audio').count()).toBe(0)
      const evidence = await page.evaluate(() => {
        if (
          !('pcmObservations' in window) ||
          !Array.isArray(window.pcmObservations) ||
          !('pcmCounterObservations' in window) ||
          !Array.isArray(window.pcmCounterObservations)
        )
          throw new Error('Missing allocation instrumentation')
        return {
          allocations: window.pcmObservations,
          counters: window.pcmCounterObservations,
        }
      })
      const counters = evidence.counters.map((value) => {
        if (
          !value ||
          typeof value !== 'object' ||
          !('values' in value) ||
          !value.values ||
          typeof value.values !== 'object'
        )
          throw new Error('Invalid counters')
        return value.values
      })
      const counterHighWater = Math.max(
        ...counters.map((value) =>
          Number(
            'data-owned-audio-bytes' in value
              ? value['data-owned-audio-bytes']
              : NaN,
          ),
        ),
      )
      const wavAllocation = evidence.allocations.find(
        (value) => value.kind === 'wav-blob',
      )
      const wavBuffer = evidence.allocations.find(
        (value) => value.kind === 'main-buffer' && value.bytes === 14400044,
      )
      expect(wavAllocation?.bytes).toBe(14400044)
      expect(wavBuffer?.bytes).toBe(14400044)
      // React can batch the synchronous Blob-construction peak out of the DOM.
      // Count the independently observed WAV buffer and immutable Blob together.
      const highWater = Math.max(
        counterHighWater,
        Number(baseline) +
          (wavAllocation?.bytes ?? 0) +
          (wavBuffer?.bytes ?? 0),
      )
      expect(highWater).toBeLessThanOrEqual(96 * 1024 * 1024)
      expect(
        counters.some(
          (value) =>
            'data-verification-bytes' in value &&
            Number(value['data-verification-bytes']) === 28800032 &&
            'data-playback-bytes' in value &&
            Number(value['data-playback-bytes']) === 0,
        ),
      ).toBe(true)
      // Main-thread PCM reads are WAV chunks only; the full 28.8 MB read is in the worker.
      expect(
        evidence.allocations.some(
          (value) => value.kind === 'main-read' && value.bytes > 262144,
        ),
      ).toBe(false)
      expect(
        evidence.allocations.some(
          (value) =>
            value.kind === 'worker-read' &&
            value.bytes === 28800000 &&
            String(value.worker).includes('pcmVerification.worker'),
        ),
      ).toBe(true)
      const lastVerification = evidence.allocations.findLastIndex(
        (value) =>
          value.kind === 'worker-start' &&
          String(value.worker).includes('pcmVerification.worker'),
      )
      const wavRelease = evidence.allocations.findIndex(
        (value) => value.kind === 'wav-url-revoke',
      )
      expect(wavRelease).toBeGreaterThanOrEqual(0)
      expect(lastVerification).toBeGreaterThan(wavRelease)
      const verifyStarts = evidence.allocations.filter(
        (value) =>
          value.kind === 'worker-start' &&
          String(value.worker).includes('pcmVerification.worker'),
      ).length
      const verifyStops = evidence.allocations.filter(
        (value) =>
          value.kind === 'worker-stop' &&
          String(value.worker).includes('pcmVerification.worker'),
      ).length
      expect(verifyStarts).toBe(verifyStops)
      await page
        .getByRole('button', { name: 'Play captured audio', exact: true })
        .click()
      await page.locator('audio').waitFor()
      await writeFile(
        join(folder, '300s-save.json'),
        JSON.stringify(
          {
            browser: browser.version(),
            fixture:
              'controlled polyphonic 7,200,000 sample PCM; real UI/player/worker/IndexedDB; no paced capture or accuracy claim',
            highWater,
            counterHighWater,
            ...evidence,
          },
          null,
          2,
        ),
      )
      console.log(
        `300s save allocation evidence: ${folder}; owned-buffer high-water ${highWater}`,
      )
    } finally {
      await browser.close()
    }
  },
  90000,
)

it.skipIf(!process.env.LIVE_BROWSER_URL)(
  'links a short resumed capture before its first patch, rejects queued old status/late patches, and permits annotation removal and valid Save/JSON',
  async () => {
    const folder = await mkdtemp(join(tmpdir(), 'fretbloom-anchor-fixes-'))
    const file = join(folder, 'mic.wav')
    const wav = Buffer.alloc(44 + 48000 * 10 * 2)
    wav.write('RIFF')
    wav.writeUInt32LE(wav.length - 8, 4)
    wav.write('WAVEfmt ', 8)
    wav.writeUInt32LE(16, 16)
    wav.writeUInt16LE(1, 20)
    wav.writeUInt16LE(1, 22)
    wav.writeUInt32LE(48000, 24)
    wav.writeUInt32LE(96000, 28)
    wav.writeUInt16LE(2, 32)
    wav.writeUInt16LE(16, 34)
    wav.write('data', 36)
    wav.writeUInt32LE(wav.length - 44, 40)
    for (let i = 0; i < (wav.length - 44) / 2; i++)
      wav.writeInt16LE(
        Math.round(Math.sin((i / 48000) * Math.PI * 440) * 10000),
        44 + i * 2,
      )
    await writeFile(file, wav)
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${file}`,
      ],
    })
    try {
      const page = await browser.newPage({ permissions: ['microphone'] })
      // Controlled delayed/replayed transport envelopes; real capture/worklet/ingest/WASM runs underneath.
      await page.addInitScript(`
      window.anchorProbe = { holdNew: false, oldStatus: null, oldPatch: null, send: null, held: [], events: [] };
      const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
      Object.defineProperty(Worker.prototype, 'onmessage', {
        configurable: true, get: descriptor.get,
        set(handler) {
          descriptor.set.call(this, typeof handler !== 'function' ? handler : function(event) {
            const data = event.data, probe = window.anchorProbe;
            if (data && data.type === 'event') {
              const e = data.event;
              probe.send = value => handler.call(this, new MessageEvent('message', { data: value }));
              if (e.type === 'status' && e.capturePosition && e.captureEpoch === 0) probe.oldStatus = structuredClone(data);
              if (e.type === 'timeline' && e.patch.segmentId === 0) probe.oldPatch = structuredClone(data);
              if (probe.holdNew && e.type === 'status' && e.captureEpoch === 1 && e.capturePosition) {
                probe.held.push(data); return;
              }
              if (e.type === 'timeline' && e.patch.segmentId === 1) probe.events.push('resumed-patch');
            }
            handler.call(this, event);
          });
        }
      });
    `)
      await page.routeWebSocket('**/*', (socket) => socket.close())
      await page.route('https://www.youtube-nocookie.com/**', (route) =>
        route.fulfill({
          body: '<html><body>Controlled iframe clock source</body></html>',
          contentType: 'text/html',
        }),
      )
      await page.goto(`${process.env.LIVE_BROWSER_URL}/listen`, {
        waitUntil: 'domcontentloaded',
      })
      await page.getByRole('radio', { name: 'Microphone / interface' }).check()
      await page
        .getByRole('button', { name: 'Start capture', exact: true })
        .click()
      await page.waitForFunction(
        () => document.querySelectorAll('.live-event').length > 0,
      )
      await page.locator('.live-video summary').click()
      await page.getByLabel('YouTube link or video ID').fill('abcdefghijk')
      await page
        .getByRole('button', { name: 'Open video', exact: true })
        .click()
      await page.locator('.live-video iframe').waitFor()
      await page
        .getByLabel('I confirm I am capturing this video’s audio.')
        .check()
      const clock = async () =>
        page.locator('.live-video iframe').evaluate((node) => {
          if (!(node instanceof HTMLIFrameElement))
            throw new Error('Missing iframe')
          window.dispatchEvent(
            new MessageEvent('message', {
              origin: 'https://www.youtube-nocookie.com',
              source: node.contentWindow,
              data: {
                event: 'infoDelivery',
                info: { currentTime: 12, playerState: 1, playbackRate: 1 },
              },
            }),
          )
        })
      await clock()
      const link = page.getByRole('button', {
        name: 'Link this moment to the video',
        exact: true,
      })
      await page.getByRole('button', { name: 'Pause', exact: true }).click()
      await page.evaluate(`{
        const original = AudioContext.prototype.resume;
        AudioContext.prototype.resume = function() {
          AudioContext.prototype.resume = original;
          return Promise.reject(new Error('Controlled resume failure'));
        };
      }`)
      await page
        .getByRole('button', { name: 'Resume capture', exact: true })
        .click()
      await page
        .getByText('Controlled resume failure', { exact: true })
        .waitFor()
      expect(await link.isDisabled()).toBe(true)
      await page.evaluate(`{
        const original = AudioContext.prototype.resume;
        AudioContext.prototype.resume = function() {
          AudioContext.prototype.resume = original;
          const context = this;
          return new Promise((resolve, reject) => {
            window.finishResume = () => original.call(context).then(resolve, reject);
          });
        };
      }`)
      await page.evaluate('window.anchorProbe.holdNew = true')
      await page
        .getByRole('button', { name: 'Resume capture', exact: true })
        .evaluate((button) => {
          if (!(button instanceof HTMLButtonElement))
            throw new Error('Missing Resume button')
          button.click()
          button.click()
        })
      await page.evaluate('window.finishResume()')
      await page.getByRole('button', { name: 'Pause', exact: true }).waitFor()
      await page.evaluate(
        'window.anchorProbe.send(window.anchorProbe.oldStatus)',
      )
      expect(await link.isDisabled()).toBe(true)
      // Release the first authoritative resumed position, while withholding any new analysis.
      await page.waitForFunction('window.anchorProbe.held.length > 0')
      await page.evaluate(`{
      const probe = window.anchorProbe;
      probe.send(probe.held[0]);
      if (probe.oldPatch) { const patch = structuredClone(probe.oldPatch); patch.event.patch.revision += 100; probe.send(patch); }
    }`)
      await clock()
      expect(await page.evaluate('window.anchorProbe.events')).toEqual([])
      await link.click()
      // Pause now: keep the resumed fragment below the first analysis window.
      await page.getByRole('button', { name: 'Pause', exact: true }).click()
      await page
        .getByRole('button', { name: 'Stop capture', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Save on this browser', exact: true })
        .waitFor()
      await page
        .getByRole('button', { name: 'Save on this browser', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Saved on this browser', exact: true })
        .waitFor()
      await page.addScriptTag({
        type: 'module',
        content:
          "import * as storage from '/src/data/listeningSessions.ts'; window.listeningStorage = storage;",
      })
      await page.waitForFunction(() => !!window.listeningStorage)
      const saved = await page.evaluate(async () => {
        const saved = (await window.listeningStorage.listListeningSessions())[0]
        return {
          saved,
          json: await window.listeningStorage.exportListeningJson(saved).text(),
        }
      })
      expect(saved.saved.anchors).toHaveLength(1)
      expect(saved.saved.anchors[0].segmentId).toBe(1)
      expect(saved.saved.anchors[0].captureSample).toBeGreaterThan(
        saved.saved.analysis.segments[1].startSample,
      )
      expect(
        saved.saved.analysis.segments[1].endSample -
          saved.saved.analysis.segments[1].startSample,
      ).toBeLessThan(30720)
      if (
        saved.saved.analysis.segments[1].endSample -
          saved.saved.analysis.segments[1].startSample <
        15360
      ) {
        expect(
          saved.saved.analysis.results.some((result) => result.segmentId === 1),
        ).toBe(false)
      }
      expect(JSON.parse(saved.json).anchors).toHaveLength(1)
      await page
        .getByRole('button', { name: 'Remove annotation 1', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Save on this browser', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Saved on this browser', exact: true })
        .waitFor()
      expect(
        await page.evaluate(
          async () =>
            (await window.listeningStorage.listListeningSessions())[0].anchors
              .length,
        ),
      ).toBe(0)
      // A delayed context resume must not turn a stopped session back into capture.
      await page
        .getByRole('button', { name: 'Discard current / new capture' })
        .click()
      await page
        .getByRole('button', { name: 'Start capture', exact: true })
        .click()
      await page.getByRole('button', { name: 'Pause', exact: true }).click()
      await page.evaluate(`{
        const original = AudioContext.prototype.resume;
        AudioContext.prototype.resume = function() {
          AudioContext.prototype.resume = original;
          const context = this;
          return new Promise((resolve, reject) => { window.finishResume = () => original.call(context).then(resolve, reject); });
        };
      }`)
      await page
        .getByRole('button', { name: 'Resume capture', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Stop capture', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Discard current / new capture' })
        .waitFor()
      await page.evaluate('window.finishResume()')
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      )
      expect(
        await page.getByRole('button', { name: 'Pause', exact: true }).count(),
      ).toBe(0)
      expect(await page.locator('.live-status').innerText()).not.toContain(
        'Capturing resumed',
      )
      await writeFile(
        join(folder, 'anchor.json'),
        JSON.stringify(
          {
            browser: browser.version(),
            ...saved,
            transport:
              'controlled delayed/replayed status and prior patch; real fake-device microphone capture; controlled iframe clock, no actual YouTube alignment claim',
          },
          null,
          2,
        ),
      )
    } finally {
      await browser.close()
      await rm(file, { force: true })
    }
  },
  60000,
)
