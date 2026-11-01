/** Private runtime: raw exports never escape the generated guarded facade.
 * Bounds are enforced inside WASM before every saved-stack access. Statistics
 * and the stack allocation are not a substitute for those guards.
 */
export function asyncifyRuntime(
  wasm,
  { stackBytes = 1024 * 1024, budgetMs = 50, yieldTask } = {},
) {
  if (
    !Number.isInteger(stackBytes) ||
    stackBytes < 4 ||
    stackBytes > 1024 * 1024
  )
    throw Error('Invalid Asyncify saved-stack allocation')
  const allocationBytes = stackBytes + 8
  const pointer = wasm.__wbindgen_malloc(allocationBytes, 8) >>> 0
  const begin = pointer + 8,
    end = begin + stackBytes
  if (!pointer || end > wasm.memory.buffer.byteLength)
    throw Error('Invalid Asyncify allocation')
  new Uint32Array(wasm.memory.buffer, pointer, 2).set([begin, end])
  wasm.fretbloom_asyncify_set_bounds(pointer, begin, end)
  const channel = new MessageChannel()
  let pending = null,
    busy = false,
    failed = false,
    closed = false,
    last = 0
  let savedStackHighWater = 0
  channel.port1.onmessage = () => {
    const resolve = pending
    pending = null
    resolve?.(0)
  }
  function task() {
    if (closed || pending) throw Error('Closed or concurrent Asyncify yield')
    return new Promise((resolve) => {
      pending = resolve
      channel.port2.postMessage(0)
    })
  }
  function poll() {
    if (!busy || failed || closed)
      throw Error('Asyncify poll outside an active call')
    if (wasm.asyncify_get_state() === 2) {
      wasm.asyncify_stop_rewind()
      last = performance.now()
      return 0
    }
    if (performance.now() - last >= budgetMs)
      wasm.asyncify_start_unwind(pointer)
    return 0
  }
  async function call(...args) {
    if (busy || failed || closed)
      throw Error('Asyncify instance is busy or unavailable')
    busy = true
    last = performance.now()
    try {
      for (;;) {
        const tuple = wasm.analyze_pcm_json(...args)
        const state = wasm.asyncify_get_state()
        if (state === 0) return tuple
        if (state !== 1) throw Error('Unexpected Asyncify state')
        // The unwind tuple is deliberately neither decoded nor freed.
        savedStackHighWater = Math.max(
          savedStackHighWater,
          new Uint32Array(wasm.memory.buffer, pointer, 1)[0] - begin,
        )
        wasm.asyncify_stop_unwind()
        const zero = await (yieldTask ? yieldTask() : task())
        if (zero !== 0 || closed)
          throw Error('Invalid or closed Asyncify resume')
        wasm.asyncify_start_rewind(pointer)
      }
    } catch (error) {
      failed = true
      throw error
    } finally {
      busy = false
    }
  }
  return {
    poll,
    call,
    failed: () => failed,
    allocationBytes,
    savedStackHighWater: () => savedStackHighWater,
    close() {
      if (closed) return
      closed = true
      channel.port1.close()
      channel.port2.close()
      pending?.(0)
      pending = null
      // A trap or suspended stack must never re-enter the allocator.
      // Whole-instance disposal reclaims the fixed stack; close never re-enters guest code.
    },
  }
}
