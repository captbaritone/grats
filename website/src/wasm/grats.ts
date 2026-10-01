/**
 * The WebAssembly build of Grats, for the playground. See
 * grats-rs/crates/grats_wasm, which builds it and describes its ABI.
 */

export type CompileRequest = {
  /**
   * The text of each file of the project, by absolute path. Grats' types can
   * be imported from `"grats"` if the package is among them, in
   * `/node_modules/grats`.
   */
  files: Record<string, string>;
  /**
   * The files to extract GraphQL definitions from, along with the files they
   * import.
   */
  rootNames: string[];
  /**
   * The `grats` key of the project's `tsconfig.json`, which is in `/`.
   */
  config: { [option: string]: unknown };
};

export type CompileResult =
  | { kind: "OK"; value: Compiled }
  | { kind: "ERROR"; err: Diagnostic[] };

export type Compiled = {
  /** The files which the CLI would write, as the config asks for them. */
  outputs: {
    graphqlSchema: string;
    tsSchema: string;
    tsClientEnums?: string;
    metadata?: string;
  };
  /** Warnings about the config. */
  warnings: string[];
};

export type Diagnostic = {
  message: string;
  /** The diagnostic as the CLI reports it, without color. */
  formatted: string;
  location: FileLocation | null;
  relatedInformation: { message: string; location: FileLocation }[];
  fix: CodeFixAction | null;
};

/** A span of a file. Offsets are UTF-16, like JavaScript's. */
export type FileLocation = { fileName: string; start: number; length: number };

/** Like TypeScript's `CodeFixAction`. */
export type CodeFixAction = {
  fixName: string;
  description: string;
  changes: {
    fileName: string;
    textChanges: {
      span: { start: number; length: number };
      newText: string;
    }[];
  }[];
};

type Exports = {
  memory: WebAssembly.Memory;
  init(): void;
  alloc(len: number): number;
  output_ptr(): number;
  output_len(): number;
  compile(ptr: number, len: number): void;
};

type EntryPoint = "compile";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class Grats {
  private _exports: Exports | null;

  private constructor(
    private readonly _module: WebAssembly.Module,
    instance: WebAssembly.Instance,
  ) {
    this._exports = initialize(instance);
  }

  /** Compiles and instantiates the module, given it or its bytes. */
  static async load(source: WebAssembly.Module | BufferSource): Promise<Grats> {
    const module =
      source instanceof WebAssembly.Module
        ? source
        : await WebAssembly.compile(source);
    return new Grats(module, await WebAssembly.instantiate(module, {}));
  }

  /** Like running the CLI on the project, keeping what it would write. */
  compile(request: CompileRequest): CompileResult {
    return JSON.parse(this._call("compile", JSON.stringify(request)));
  }

  private _call(entryPoint: EntryPoint, input: string): string {
    // After a trap, the instance is replaced, since its memory may be left
    // inconsistent. Instantiating synchronously is fine in a worker or Node.
    const exports =
      this._exports ?? initialize(new WebAssembly.Instance(this._module, {}));
    this._exports = null;
    const bytes = encoder.encode(input);
    const ptr = exports.alloc(bytes.length);
    new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes);
    try {
      exports[entryPoint](ptr, bytes.length);
    } catch (e) {
      // The panic hook stores the panic's message as the output.
      const message = readOutput(exports) || String(e);
      throw new Error(`Grats internal error in \`${entryPoint}\`: ${message}`);
    }
    this._exports = exports;
    return readOutput(exports);
  }
}

function initialize(instance: WebAssembly.Instance): Exports {
  const exports = instance.exports as unknown as Exports;
  exports.init();
  return exports;
}

function readOutput(exports: Exports): string {
  return decoder.decode(
    new Uint8Array(
      exports.memory.buffer,
      exports.output_ptr(),
      exports.output_len(),
    ),
  );
}
