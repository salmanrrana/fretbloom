// Pinned bindgen 0.2.100 MULTIVALUE + EXTERNREFS adapter. Fail closed on drift.
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
const hash = (s) => createHash('sha256').update(s).digest('hex')
function replace(s, from, to, count = 1) {
  if (s.split(from).length - 1 !== count)
    throw Error(`JSPI glue shape drift: ${from}`)
  return s.split(from).join(to)
}
export async function adapt(directory) {
  const path = resolve(directory, 'fretbloom_wasm.js')
  let js = await readFile(path, 'utf8')
  let types = await readFile(resolve(directory, 'fretbloom_wasm.d.ts'), 'utf8')
  if (
    hash(js) !==
      '0174f1e2f73d954f7a43757eeb865ad606401596789e734560cb2ca91701dde8' ||
    hash(types) !==
      '826fabf909bdf0e89d869aaec611c4b00bef748fe94dc7b881da06d26023da10' ||
    hash(await readFile(resolve(directory, 'fretbloom_wasm_bg.wasm.d.ts'))) !==
      '8fb535b7d0a88b698f4b84cb1ce417e57e1ee0e06162177e34074ef37a664529'
  )
    throw Error(
      'Pinned bindgen ABI/glue drift; review adapter before generation',
    )
  const begin = js.indexOf('export function analyze_pcm_json(')
  const end = js.indexOf('\nasync function __wbg_load', begin)
  let wrapper = js.slice(begin, end)
  wrapper = replace(
    wrapper,
    'export function analyze_pcm_json(mono, sample_rate_hz, options_json)',
    'export async function analyze_pcm_json_async(mono, sample_rate_hz, options_json, promising)',
  )
  wrapper = replace(
    wrapper,
    'wasm.analyze_pcm_json(ptr0, len0, sample_rate_hz, ptr1, len1)',
    'await promising(ptr0, len0, sample_rate_hz, ptr1, len1)',
  )
  // Rust/bindgen own the inputs once invoked. Only a success tuple owns a return string.
  wrapper = replace(
    wrapper,
    'wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);',
    'if (deferred4_0 !== undefined) wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);',
  )
  js = js.slice(0, end) + '\n' + wrapper + js.slice(end)
  js = replace(
    js,
    "import * as __wbg_star0 from 'fretbloom_host';",
    '// Default synchronous tooling import must never suspend.\nconst synchronousPoll = () => 0;',
  )
  js = replace(
    js,
    'function __wbg_get_imports()',
    'function __wbg_get_imports(host_poll)',
  )
  js = replace(
    js,
    "imports['fretbloom_host'] = __wbg_star0;",
    "imports['fretbloom_host'] = { poll: host_poll ?? synchronousPoll };",
  )
  js = replace(
    js,
    'function initSync(module) {',
    'function initSync(module) {\n    let host_poll;',
  )
  js = replace(js, '({module} = module)', '({module, host_poll} = module)')
  js = replace(
    js,
    'async function __wbg_init(module_or_path) {',
    'async function __wbg_init(module_or_path) {\n    let host_poll;',
  )
  js = replace(
    js,
    '({module_or_path} = module_or_path)',
    '({module_or_path, host_poll} = module_or_path)',
  )
  js = replace(js, '__wbg_get_imports();', '__wbg_get_imports(host_poll);', 2)
  types = replace(
    types,
    'export type InitInput',
    `/** Raw promising export, derived from the pinned four-value ABI. */
export type PromisingAnalyze = (...args: Parameters<InitOutput['analyze_pcm_json']>) => Promise<ReturnType<InitOutput['analyze_pcm_json']>>;
export function analyze_pcm_json_async(mono: Float32Array, sample_rate_hz: number, options_json: string, promising: PromisingAnalyze): Promise<string>;

export type InitInput`,
  )
  types = replace(
    types,
    'module: SyncInitInput }',
    'module: SyncInitInput; host_poll?: WebAssembly.ImportValue }',
    2,
  )
  types = replace(
    types,
    'module_or_path: InitInput | Promise<InitInput> }',
    'module_or_path: InitInput | Promise<InitInput>; host_poll?: WebAssembly.ImportValue }',
    2,
  )
  await writeFile(path, js)
  await writeFile(resolve(directory, 'fretbloom_wasm.d.ts'), types)
}
