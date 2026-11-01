import type {
  InitOutput,
  PromisingAnalyze,
} from '../../generated/analysis-wasm/fretbloom_wasm'

/** Optional JSPI APIs absent from older TypeScript WebAssembly declarations. */
type Jspi = {
  Suspending: new (
    poll: () => number | Promise<number>,
  ) => WebAssembly.ImportValue
  promising: (raw: InitOutput['analyze_pcm_json']) => PromisingAnalyze
}
export function jspiApi(): Jspi | null {
  const api: unknown = WebAssembly
  if (
    typeof api !== 'object' ||
    api === null ||
    !('Suspending' in api) ||
    typeof api.Suspending !== 'function' ||
    !('promising' in api) ||
    typeof api.promising !== 'function'
  )
    return null
  // One compatibility boundary for optional native APIs; no global patching.
  return api as Jspi
}

/** One reusable channel, at most one outstanding task, numeric i32 resolution. */
export function taskYield() {
  const channel = new MessageChannel()
  let pending: ((zero: number) => void) | null = null
  let last = performance.now()
  channel.port1.onmessage = () => {
    const resolve = pending
    pending = null
    last = performance.now()
    resolve?.(0)
  }
  return {
    reset() {
      last = performance.now()
    },
    poll(): number | Promise<number> {
      if (performance.now() - last < 50) return 0
      if (pending) throw new Error('Concurrent task yield')
      return new Promise<number>((resolve) => {
        pending = resolve
        channel.port2.postMessage(0)
      })
    },
    close() {
      channel.port1.close()
      channel.port2.close()
      pending?.(0)
      pending = null
    },
  }
}
