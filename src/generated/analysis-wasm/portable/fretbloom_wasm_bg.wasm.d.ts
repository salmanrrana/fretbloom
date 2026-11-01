/** Private final assembled ABI. Use the guarded facade. */
export const memory: WebAssembly.Memory;
export const engine_info_json: () => [number, number];
export const analyze_pcm_json: (a0: number, a1: number, a2: number, a3: number, a4: number) => [number, number, number, number];
export const __wbindgen_free: (a0: number, a1: number, a2: number) => void;
export const __wbindgen_malloc: (a0: number, a1: number) => number;
export const __wbindgen_realloc: (a0: number, a1: number, a2: number, a3: number) => number;
export const asyncify_start_unwind: (a0: number) => void;
export const asyncify_stop_unwind: () => void;
export const asyncify_start_rewind: (a0: number) => void;
export const asyncify_stop_rewind: () => void;
export const asyncify_get_state: () => number;
export const fretbloom_asyncify_set_bounds: (a0: number, a1: number, a2: number) => void;
