/** Guard Binaryen125 generated stack accesses, preserving all other WAT bytes.
 * No call-graph assumptions: also covers frames reached via indirect calls.
 * Unknown cursor use is a generation error, never an unguarded fallback.
 */
import { createHash } from 'node:crypto'
const sha = (s) => createHash('sha256').update(s).digest('hex')
export function parseWat(text) {
  const roots = [],
    stack = []
  let i = 0
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++
      continue
    }
    if (text.startsWith(';;', i)) {
      const end = text.indexOf('\n', i)
      i = end < 0 ? text.length : end
      continue
    }
    if (text.startsWith('(;', i)) {
      let depth = 1
      i += 2
      while (depth && i < text.length) {
        if (text.startsWith('(;', i)) {
          depth++
          i += 2
        } else if (text.startsWith(';)', i)) {
          depth--
          i += 2
        } else i++
      }
      if (depth) throw Error('Unclosed WAT comment')
      continue
    }
    if (text[i] === '(') {
      const node = { start: i++, end: 0, items: [] }
      const parent = stack.at(-1)
      if (parent) parent.items.push(node)
      else roots.push(node)
      stack.push(node)
      continue
    }
    if (text[i] === ')') {
      if (!stack.length) throw Error('Unbalanced WAT')
      stack.pop().end = ++i
      continue
    }
    const start = i
    if (text[i] === '"') {
      i++
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++
        i++
      }
      if (i === text.length) throw Error('Unclosed WAT string')
      i++
    } else while (i < text.length && !/[\s()]/.test(text[i])) i++
    if (!stack.length) throw Error('WAT atom outside expression')
    stack.at(-1).items.push(text.slice(start, i))
  }
  if (stack.length || roots.length !== 1 || roots[0].items[0] !== 'module')
    throw Error('Expected single WAT module')
  return roots[0]
}
const head = (n) => (typeof n === 'object' ? n.items[0] : null)
function children(n) {
  return n.items.filter((i) => typeof i === 'object')
}
function walk(root, visit) {
  const queue = [[root, null]]
  while (queue.length) {
    const [n, parent] = queue.pop()
    visit(n, parent)
    for (const child of children(n)) queue.push([child, n])
  }
}
const same = (n, a) => JSON.stringify(n?.items) === JSON.stringify(a)
const loadStore = (n) =>
  /^(?:i32|i64|f32|f64)\.(?:load|store)(?:8|16|32)?(?:_[su])?$/.test(head(n))
function size(n) {
  const match = head(n).match(/^(i32|i64|f32|f64)\.(?:load|store)(8|16|32)?/)
  if (!match) throw Error('Unknown stack access')
  const width = match[2] ? Number(match[2]) / 8 : Number(match[1].slice(1)) / 8
  const offsets = n.items.filter(
    (x) => typeof x === 'string' && x.startsWith('offset='),
  )
  if (offsets.length > 1) throw Error('Duplicate offset')
  const offset = offsets.length ? Number(offsets[0].slice(7)) : 0
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset + width > 0xffffffff
  )
    throw Error('Invalid stack offset')
  return offset + width
}
export function guardWat(text) {
  const module = parseWat(text)
  if (text.includes('$fretbloom_asyncify_'))
    throw Error('Guard already present or name collision')
  const memories = module.items.filter((n) => head(n) === 'memory')
  if (
    memories.length !== 1 ||
    memories[0].items.some((x) => x === 'shared' || x === 'i64')
  )
    throw Error('Only the existing single unshared wasm32 memory is supported')
  const functions = module.items.filter((n) => head(n) === 'func')
  const exportedFunction = (name) => {
    const exports = module.items.filter(
      (n) => head(n) === 'export' && n.items[1] === JSON.stringify(name),
    )
    if (exports.length !== 1) throw Error(`Missing/duplicate ${name}`)
    return exports[0].items[2].items[1]
  }
  const functionMap = new Map(functions.map((n) => [n.items[1], n]))
  const getStateName = exportedFunction('asyncify_get_state')
  const getState = functionMap.get(getStateName)
  const stateGets = children(getState).filter((n) => head(n) === 'global.get')
  if (stateGets.length !== 1) throw Error('State export drift')
  const state = stateGets[0].items[1]
  const startName = exportedFunction('asyncify_start_unwind')
  const start = functionMap.get(startName)
  const dataSets = children(start).filter(
    (n) => head(n) === 'global.set' && n.items[1] !== state,
  )
  if (dataSets.length !== 1) throw Error('Data global drift')
  const data = dataSets[0].items[1]
  const canon = (n) => (typeof n === 'object' ? n.items.map(canon) : n)
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const globals = module.items.filter((n) => head(n) === 'global')
  for (const name of [data, state]) {
    const g = globals.find((n) => n.items[1] === name)
    if (
      !g ||
      !equal(canon(g), ['global', name, ['mut', 'i32'], ['i32.const', '0']])
    )
      throw Error('Private Asyncify global drift')
  }
  const controls = new Set()
  const controlEntries = []
  for (const [name, value, pointer] of [
    ['asyncify_start_unwind', '1', true],
    ['asyncify_stop_unwind', '0', false],
    ['asyncify_start_rewind', '2', true],
    ['asyncify_stop_rewind', '0', false],
    ['asyncify_get_state', null, false],
  ]) {
    const target = exportedFunction(name),
      fn = functionMap.get(target)
    if (!fn) throw Error('Missing defined control')
    controls.add(target)
    const pointerName = pointer
      ? children(fn).find((n) => head(n) === 'param')?.items[1]
      : null
    if (pointer && !String(pointerName).startsWith('$'))
      throw Error('Unnamed control pointer unsupported')
    const body = children(fn)
      .filter((n) => head(n) !== 'type')
      .map(canon)
    const expected =
      value === null
        ? [
            ['result', 'i32'],
            ['global.get', state],
          ]
        : [
            ...(pointer ? [['param', pointerName, 'i32']] : []),
            ['global.set', state, ['i32.const', value]],
            ...(pointer
              ? [['global.set', data, ['local.get', pointerName]]]
              : []),
            [
              'if',
              [
                'i32.gt_u',
                ['i32.load', ['global.get', data]],
                ['i32.load', 'offset=4', ['global.get', data]],
              ],
              ['then', ['unreachable']],
            ],
          ]
    if (!equal(body, expected))
      throw Error('Exact Asyncify control drift: ' + name)
    if (pointer)
      controlEntries.push([
        children(fn).find((n) => head(n) === 'global.set').start,
        pointerName,
      ])
  }
  // Pinned wasm-dis uses only symbolic references. Refuse alternate numeric
  // spellings instead of silently treating them as different globals/functions.
  walk(module, (n, parent) => {
    if (
      ['global.get', 'global.set'].includes(head(n)) &&
      (!String(n.items[1]).startsWith('$') ||
        !globals.some((g) => g.items[1] === n.items[1]))
    )
      throw Error('Unresolved/numeric global reference')
    if (
      head(n) === 'import' &&
      children(n).some((c) => ['global', 'memory', 'table'].includes(head(c)))
    )
      throw Error('Imported storage is unsupported')
    if (head(n) === 'export' && head(n.items[2]) === 'global')
      throw Error('Asyncify globals must stay private')
    if (
      head(n) === 'global.set' &&
      n.items[1] === state &&
      !controls.has(parent?.items[1])
    )
      throw Error('Unexpected state write')
    if (
      ['call', 'return_call', 'ref.func'].includes(head(n)) &&
      !String(n.items[1]).startsWith('$')
    )
      throw Error('Numeric function alias unsupported')
    if (
      ['call', 'return_call', 'ref.func', 'elem'].includes(head(n)) &&
      n.items.some((i) => typeof i === 'string' && controls.has(i))
    )
      throw Error('Guest route to host-only control')
  })
  const dataGet = (n) => same(n, ['global.get', data])
  const metadata = (n) =>
    head(n) === 'i32.load' &&
    children(n).length === 1 &&
    dataGet(children(n)[0]) &&
    !n.items.some((x) => typeof x === 'string' && x.startsWith('offset='))
  // Reject unconfigured, wrong-header and out-of-range cursors before either
  // start control changes state. A zero span permits both valid endpoints.
  const insertions = controlEntries.map(([at, pointerName]) => [
      at,
      `(if (i32.or (i32.eqz (global.get $fretbloom_asyncify_begin)) (i32.ne (local.get ${pointerName}) (global.get $fretbloom_asyncify_header))) (then (unreachable)))
  (drop (call $fretbloom_asyncify_check (i32.load (local.get ${pointerName})) (i32.const 0)))
  `,
    ]),
    counts = {
      callIndexLoads: 0,
      callIndexStores: 0,
      localLoads: 0,
      localStores: 0,
      cursorLocals: 0,
      metadataReads: 0,
      metadataWrites: 0,
      cursorUpdates: 0,
    }
  const knownMetadata = new Set()
  for (const fn of functions) {
    const locals = new Set(),
      assignments = new Map()
    walk(fn, (n) => {
      if (head(n) === 'local.set' || head(n) === 'local.tee') {
        const all = assignments.get(n.items[1]) ?? []
        all.push(n)
        assignments.set(n.items[1], all)
        if (metadata(n.items[2])) locals.add(n.items[1])
      }
    })
    for (const local of locals) {
      const all = assignments.get(local)
      if (
        all.length !== 1 ||
        head(all[0]) !== 'local.set' ||
        !metadata(all[0].items[2])
      )
        throw Error('Stack cursor local reassigned/aliased')
      knownMetadata.add(all[0].items[2])
    }
    counts.cursorLocals += locals.size
    const frameSpans = new Map()
    walk(fn, (n) => {
      if (loadStore(n)) {
        const address = children(n)[0]
        if (head(address) === 'local.get' && locals.has(address.items[1]))
          frameSpans.set(
            address.items[1],
            Math.max(frameSpans.get(address.items[1]) ?? 0, size(n)),
          )
      }
    })
    const deltas = new Set([4, ...frameSpans.values()])
    walk(fn, (n, parent) => {
      if (head(n) === 'global.get' && n.items[1] === data) {
        if (
          !loadStore(parent) ||
          children(parent)[0] !== n ||
          !/^i32\.(load|store)$/.test(head(parent))
        )
          throw Error('Unknown Asyncify data global use')
        const span = size(parent)
        if (
          parent.items.some(
            (x) => typeof x === 'string' && x.startsWith('offset='),
          ) &&
          span === 4
        )
          throw Error('Explicit-zero metadata alias unsupported')
        if (span === 8 && !controls.has(fn.items[1]))
          throw Error('Asyncify end pointer escape')
        if (span !== 4 && span !== 8)
          throw Error('Unknown Asyncify metadata offset')
        if (head(parent) === 'i32.store') {
          if (span !== 4) throw Error('Asyncify end changed inside guest')
          counts.metadataWrites++
          const value = children(parent)[1]
          // Only cursor +/- constant; the end address is set by the host once.
          if (
            head(value) !== 'i32.add' ||
            !metadata(children(value)[0]) ||
            head(children(value)[1]) !== 'i32.const'
          )
            throw Error('Unknown cursor update')
          const delta = Number(children(value)[1].items[1])
          if (
            !Number.isInteger(delta) ||
            delta === 0 ||
            Math.abs(delta) > 1024 * 1024 ||
            !deltas.has(Math.abs(delta))
          )
            throw Error('Unbounded cursor delta')
          knownMetadata.add(children(value)[0])
          // Validate the new cursor before changing the header, including
          // rewind subtraction. Fixed bounds are below 128MiB; a <=1MiB
          // step cannot wrap around 4GiB and re-enter that interval.
          counts.cursorUpdates++
          insertions.push(
            [value.start, '(call $fretbloom_asyncify_check '],
            [value.end, ' (i32.const 0))'],
          )
        } else counts.metadataReads++
      }
      if (head(n) === 'local.get' && locals.has(n.items[1])) {
        if (!loadStore(parent) || children(parent)[0] !== n)
          throw Error('Unknown stack-local escape')
      }
      if (!loadStore(n)) return
      const address = children(n)[0]
      let kind
      if (metadata(address)) {
        kind = 'callIndex'
        knownMetadata.add(address)
      } else if (head(address) === 'local.get' && locals.has(address.items[1]))
        kind = 'local'
      else return
      const write = head(n).includes('.store')
      const span = size(n)
      if (
        kind === 'callIndex' &&
        (span !== 4 || !/^i32\.(load|store)$/.test(head(n)))
      )
        throw Error('Call-index shape drift')
      counts[kind + (write ? 'Stores' : 'Loads')]++
      insertions.push(
        [address.start, '(call $fretbloom_asyncify_check '],
        [address.end, ` (i32.const ${span}))`],
      )
    })
  }
  // All cursor reads must be classified; terminal overflow assertions are the
  // only remaining metadata read, and only in Binaryen's four control exports.
  for (const fn of functions)
    walk(fn, (n, parent) => {
      if (metadata(n) && !knownMetadata.has(n)) {
        if (!controls.has(fn.items[1]) || head(parent) !== 'i32.gt_u')
          throw Error('Unclassified stack cursor read')
      }
      if (
        head(n) === 'global.set' &&
        n.items[1] === data &&
        ![startName, exportedFunction('asyncify_start_rewind')].includes(
          fn.items[1],
        )
      )
        throw Error('Data pointer changed unexpectedly')
    })
  if (
    !counts.callIndexLoads ||
    !counts.callIndexStores ||
    !counts.localLoads ||
    !counts.localStores
  )
    throw Error('No complete Asyncify stack access inventory')
  // Insertion only: no original instruction or operand is rewritten/removed.
  insertions.sort((a, b) => a[0] - b[0])
  const pieces = []
  let cursor = 0
  for (const [at, value] of insertions) {
    pieces.push(text.slice(cursor, at), value)
    cursor = at
  }
  pieces.push(text.slice(cursor))
  let out = pieces.join('')
  const helper = `
 (global $fretbloom_asyncify_header (mut i32) (i32.const 0))
 (global $fretbloom_asyncify_begin (mut i32) (i32.const 0))
 (global $fretbloom_asyncify_end (mut i32) (i32.const 0))
 (func $fretbloom_asyncify_set_bounds (param $header i32) (param $begin i32) (param $end i32)
  (if (i32.or (global.get $fretbloom_asyncify_begin)
       (i32.or (i32.gt_u (local.get $end) (i32.const 134217728))
        (i32.or (i32.gt_u (i32.sub (local.get $end) (local.get $begin)) (i32.const 1048576))
         (i32.or (i32.eqz (local.get $begin))
       (i32.or (i32.gt_u (local.get $begin) (local.get $end))
        (i64.gt_u (i64.extend_i32_u (local.get $end))
         (i64.shl (i64.extend_i32_u (memory.size)) (i64.const 16))))))))
   (then (unreachable)))
  (if (i32.or (i32.eqz (local.get $header)) (i64.ne (i64.add (i64.extend_i32_u (local.get $header)) (i64.const 8)) (i64.extend_i32_u (local.get $begin)))) (then (unreachable)))
  (global.set $fretbloom_asyncify_header (local.get $header))
  (global.set $fretbloom_asyncify_begin (local.get $begin))
  (global.set $fretbloom_asyncify_end (local.get $end)))
 (func $fretbloom_asyncify_check (param $address i32) (param $span i32) (result i32)
  (if (i32.or (i32.eqz (global.get $fretbloom_asyncify_begin))
       (i32.or (i32.lt_u (local.get $address) (global.get $fretbloom_asyncify_begin))
        (i32.or (i32.gt_u (local.get $address) (global.get $fretbloom_asyncify_end))
         (i32.gt_u (local.get $span) (i32.sub (global.get $fretbloom_asyncify_end) (local.get $address))))))
   (then (unreachable)))
  (local.get $address))
 (export "fretbloom_asyncify_set_bounds" (func $fretbloom_asyncify_set_bounds))
`
  const end = out.lastIndexOf(')')
  out = out.slice(0, end) + helper + out.slice(end)
  return {
    text: out,
    evidence: {
      inputWatSha256: sha(text),
      guardedWatSha256: sha(out),
      dataGlobal: data,
      stateGlobal: state,
      counts,
      scheme:
        'per-access unsigned pre-read/pre-write address/span; private fixed host bounds',
    },
  }
}
