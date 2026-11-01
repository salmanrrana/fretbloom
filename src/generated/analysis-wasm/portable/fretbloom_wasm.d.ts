/** Guarded portable backend; raw WASM exports/allocators stay private. */
export function initialize(input: RequestInfo | URL | Response | BufferSource | WebAssembly.Module): Promise<void>;
export function analyze(mono: Float32Array, sample_rate_hz: number, options_json: string): Promise<string>;
export function info(): string;
export function memoryBytes(): number;
/** Saved stack+header are already included in memoryBytes(), never add twice. */
export function savedStackBytes(): number;
export function close(): void;
