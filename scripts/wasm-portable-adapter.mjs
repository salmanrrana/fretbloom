/** Pinned numeric-handle five-argument / four-return bridge. Fail on drift. */
import { portableTypes } from './wasm-portable-types.mjs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
const sha = (s) => createHash('sha256').update(s).digest('hex')
function replace(s, from, to, expected = 1) {
  if (s.split(from).length - 1 !== expected)
    throw Error(`Portable glue drift: ${from}`)
  return s.split(from).join(to)
}
export async function adaptPortable(directory) {
  const path = resolve(directory, 'fretbloom_wasm.js')
  let js = await readFile(path, 'utf8')
  for (const [file, digest] of Object.entries({
    'fretbloom_wasm.js':
      'eb9a5a04a2596e6e4653ddee660403189e254f1c2c6a5d60901e868c394daa0c',
    'fretbloom_wasm.d.ts':
      'bdd6e9da235b99971efefd4d56ce917b9ce338b1548f770978a009c373cf9584',
    'fretbloom_wasm_bg.wasm.d.ts':
      '6aed79cede5dea34a5a11720e9f130a4046bf7a9038d29d0cc53edef60526520',
  }))
    if (sha(await readFile(resolve(directory, file))) !== digest)
      throw Error(`Numeric ABI hash drift: ${file}`)
  js = replace(
    js,
    "import * as __wbg_star0 from 'fretbloom_host';",
    "import { asyncifyRuntime } from './asyncify-runtime.js';\nlet controller = null;\nlet phase = 'new';\nlet cachedInfo = '';\nfunction ready() { if (phase !== 'ready') throw Error('Portable engine not ready or busy'); }",
  )
  js = replace(
    js,
    "imports['fretbloom_host'] = __wbg_star0;",
    "imports['fretbloom_host'] = { poll: () => controller ? controller.poll() : 0 };",
  )
  js = replace(
    js,
    'export function engine_info_json()',
    'function engine_info_json()',
  )
  js = replace(
    js,
    'wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);',
    'if (deferred1_0 !== undefined) wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);',
  )
  const begin = js.indexOf('export function analyze_pcm_json('),
    end = js.indexOf('\nasync function __wbg_load', begin)
  if (begin < 0 || end < 0) throw Error('Missing numeric wrapper')
  let wrapper = js.slice(begin, end)
  wrapper = replace(
    wrapper,
    'export function analyze_pcm_json(mono, sample_rate_hz, options_json) {',
    "export async function analyze(mono, sample_rate_hz, options_json) {\n    ready();\n    phase = 'busy';\n    try { return await analyzeOwned(mono, sample_rate_hz, options_json); }\n    catch (error) { if (controller.failed() || typeof error !== 'string') phase = 'failed'; throw error; }\n    finally { if (phase === 'busy') phase = 'ready'; }\n}\nasync function analyzeOwned(mono, sample_rate_hz, options_json) {",
  )
  wrapper = replace(
    wrapper,
    'wasm.analyze_pcm_json(ptr0, len0, sample_rate_hz, ptr1, len1)',
    'await controller.call(ptr0, len0, sample_rate_hz, ptr1, len1)',
  )
  wrapper = replace(
    wrapper,
    'wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);',
    'if (deferred4_0 !== undefined) wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);',
  )
  js = js.slice(0, begin) + wrapper + js.slice(end)
  const syncBegin = js.indexOf('function initSync(module) {'),
    syncEnd = js.indexOf('async function __wbg_init(', syncBegin)
  if (syncBegin < 0 || syncEnd < 0) throw Error('Init shape drift')
  js = js.slice(0, syncBegin) + js.slice(syncEnd)
  js = replace(
    js,
    'export { initSync };\nexport default __wbg_init;',
    `
export async function initialize(module_or_path) {
    if (phase !== 'new') throw Error('Portable engine already initializing/initialized');
    phase = 'initializing';
    try {
        await __wbg_init({ module_or_path });
        if (phase !== 'initializing') throw Error('Portable initialization was closed');
        controller = asyncifyRuntime(wasm);
        cachedInfo = engine_info_json();
        phase = 'ready';
    } catch (error) { phase = 'failed'; controller?.close(); throw error; }
}
export function info() { ready(); return cachedInfo; }
export function memoryBytes() { ready(); return wasm.memory.buffer.byteLength; }
export function savedStackBytes() { ready(); return controller.allocationBytes; }
export function close() {
    if (phase === 'closed') return;
    const previous = phase;
    phase = 'closed';
    controller?.close();
    if (previous === 'initializing') throw Error('Discard worker during initialization');
}
`,
  )
  await writeFile(path, js)
  await writeFile(
    resolve(directory, 'asyncify-runtime.js'),
    await readFile(new URL('./wasm-asyncify-runtime.mjs', import.meta.url)),
  )
  await writeFile(
    resolve(directory, 'fretbloom_wasm.d.ts'),
    `/** Guarded portable backend; raw WASM exports/allocators stay private. */
export function initialize(input: RequestInfo | URL | Response | BufferSource | WebAssembly.Module): Promise<void>;
export function analyze(mono: Float32Array, sample_rate_hz: number, options_json: string): Promise<string>;
export function info(): string;
export function memoryBytes(): number;
/** Saved stack+header are already included in memoryBytes(), never add twice. */
export function savedStackBytes(): number;
export function close(): void;
`,
  )
  // Private raw ABI: numeric glue has no externref table/start export.
  // The guarded facade above is the only application entry point.
  const finalTypes = portableTypes(
    await readFile(resolve(directory, 'fretbloom_wasm_bg.wasm')),
  )
  await writeFile(
    resolve(directory, 'fretbloom_wasm_bg.wasm.d.ts'),
    finalTypes.declaration,
  )
  return {
    generator: 'wasm-bindgen0.2.100 numeric multivalue',
    jsSha256: sha(js),
    finalAbi: finalTypes.evidence,
  }
}
