import { wasmBase64 } from "./wasm.generated.js";

/**
 * Calls into the Rust port of Grats, compiled to WebAssembly. See
 * `grats-rs/crates/grats_wasm` for the ABI.
 */

/** Functions exported by `grats_wasm`. Each takes a string and returns one. */
type EntryPoint =
  | "print_sdl_without_metadata"
  | "run_pipeline"
  | "print_outputs"
  | "locate";

type Exports = {
  memory: WebAssembly.Memory;
  init(): void;
  alloc(len: number): number;
  output_ptr(): number;
  output_len(): number;
} & Record<EntryPoint, (ptr: number, len: number) => void>;

// The subset of the WebAssembly JavaScript API used here, which our compiler
// options (no DOM lib) don't otherwise declare.
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace WebAssembly {
  class Module {
    constructor(bytes: Uint8Array);
  }
  class Instance {
    constructor(module: Module, imports: object);
    readonly exports: object;
  }
  class Memory {
    readonly buffer: ArrayBuffer;
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let instance: Exports | null = null;
let instanceCount = 0;

// The module is compiled synchronously, since Grats' API is synchronous.
// Browsers only allow this off the main thread, which is where the playground
// runs Grats.
function getInstance(): Exports {
  if (instance == null) {
    const module = new WebAssembly.Module(decodeBase64(wasmBase64));
    const exports = new WebAssembly.Instance(module, {}).exports;
    instance = exports as unknown as Exports;
    instance.init();
    instanceCount++;
  }
  return instance;
}

/**
 * Identifies the current instance. State that Rust keeps between calls is lost
 * when the instance is replaced.
 */
export function instanceId(): number {
  return instanceCount;
}

export function callRust(entryPoint: EntryPoint, input: string): string {
  const wasm = getInstance();
  try {
    const bytes = encoder.encode(input);
    const ptr = wasm.alloc(bytes.length);
    new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes);
    wasm[entryPoint](ptr, bytes.length);
  } catch (e) {
    // A trap leaves the instance in an unknown state, so start over next time.
    instance = null;
    const message = readOutput(wasm) || String(e);
    throw new Error(`Grats internal error in \`${entryPoint}\`: ${message}`);
  }
  return readOutput(wasm);
}

function readOutput(wasm: Exports): string {
  return decoder.decode(
    new Uint8Array(wasm.memory.buffer, wasm.output_ptr(), wasm.output_len()),
  );
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
