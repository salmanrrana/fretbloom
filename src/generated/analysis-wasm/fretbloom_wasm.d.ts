/* tslint:disable */
/* eslint-disable */
export function engine_info_json(): string;
export function analyze_pcm_json(mono: Float32Array, sample_rate_hz: number, options_json: string): string;

/** Raw promising export, derived from the pinned four-value ABI. */
export type PromisingAnalyze = (...args: Parameters<InitOutput['analyze_pcm_json']>) => Promise<ReturnType<InitOutput['analyze_pcm_json']>>;
export function analyze_pcm_json_async(mono: Float32Array, sample_rate_hz: number, options_json: string, promising: PromisingAnalyze): Promise<string>;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly engine_info_json: () => [number, number];
  readonly analyze_pcm_json: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput; host_poll?: WebAssembly.ImportValue }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput; host_poll?: WebAssembly.ImportValue } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput>; host_poll?: WebAssembly.ImportValue }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput>; host_poll?: WebAssembly.ImportValue } | InitInput | Promise<InitInput>): Promise<InitOutput>;
