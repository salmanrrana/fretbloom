import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const module = await WebAssembly.compile(
  await readFile(
    new URL(
      '../../src/generated/analysis-wasm/portable/fretbloom_wasm_bg.wasm',
      import.meta.url,
    ),
  ),
)

// Use the built module's actual private controls. A trapped instance is discarded
// without calling guest cleanup, including when bounds were never configured.
for (const control of ['asyncify_start_unwind', 'asyncify_start_rewind']) {
  for (const position of [
    'below',
    'begin',
    'end',
    'above',
    'zero',
    'wrapped',
    'wrong-header',
    'unconfigured',
  ]) {
    test(`${control}: ${position}`, async () => {
      const instance = await WebAssembly.instantiate(module, {
        fretbloom_host: { poll: () => 0 },
        wbg: new Proxy(
          {},
          {
            get: () => () => {
              throw Error('Unexpected host call')
            },
          },
        ),
      })
      const wasm = instance.exports
      const header = wasm.__wbindgen_malloc(40, 8) >>> 0
      const begin = header + 8,
        end = begin + 32
      const view = new DataView(wasm.memory.buffer)
      view.setUint32(header, begin, true)
      view.setUint32(header + 4, end, true)
      if (position !== 'unconfigured')
        wasm.fretbloom_asyncify_set_bounds(header, begin, end)
      const cursors = {
        below: begin - 1,
        begin,
        end,
        above: end + 1,
        zero: 0,
        wrapped: 0xffffffff,
      }
      view.setUint32(header, cursors[position] ?? begin, true)
      const pointer =
        position === 'wrong-header'
          ? header + 8
          : position === 'unconfigured'
            ? 0
            : header
      const enter = () => wasm[control](pointer)
      if (position === 'begin' || position === 'end') assert.doesNotThrow(enter)
      else assert.throws(enter, WebAssembly.RuntimeError)
    })
  }
}
