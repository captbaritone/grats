import monaco, { IDisposable, Emitter } from "monaco-editor";
import type { GratsWorker } from "../../workers/grats.worker";
import type { SerializableState } from "../PlaygroundFeatures/store";
import { serializeState } from "../PlaygroundFeatures/urlState";
import lzstring from "lz-string";

const CONTENT = `/** @gqlQueryField */
export function me(): User {
  return new User();
}

/**
 * A user in our kick-ass system!
 * @gqlType
 */
class User {
  /** @gqlField */
  name: string = "Alice";

  /** @gqlField */
  greeting(salutation: string): string {
    return \`\${salutation}, \${this.name}\`;
  }
}`;

export const URL_VERSION = 1;

export const DEFAULT_STATE: SerializableState = {
  doc: CONTENT,
  config: {
    nullableByDefault: true,
    reportTypeScriptTypeErrors: true,
  },
  view: {
    outputOption: "sdl",
  },
  VERSION: URL_VERSION,
};

export function stateFromUrl(): SerializableState {
  const hash = window.location.hash;
  if (!hash) return DEFAULT_STATE;

  try {
    const state = JSON.parse(
      lzstring.decompressFromEncodedURIComponent(hash.slice(1)),
    );
    if (state.VERSION === 1) {
      return {
        ...DEFAULT_STATE,
        ...state,
        config: {
          ...DEFAULT_STATE.config,
          ...state.config,
        },
        view: {
          ...DEFAULT_STATE.view,
          ...state.view,
        },
      };
    }
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_STATE;
}

export default class Sandbox {
  _tsEditor: monaco.editor.IStandaloneCodeEditor | null = null;
  _resolveWorker: (worker: GratsWorker) => void = () => {};
  _workerPromise: Promise<GratsWorker>;
  _worker: GratsWorker | null = null;
  _onDidChange = new Emitter<void>();
  _serializedState: SerializableState;
  constructor() {
    this._serializedState = stateFromUrl();
    this._workerPromise = new Promise((resolve) => {
      this._resolveWorker = resolve;
    });
  }

  async getWorker(): Promise<GratsWorker> {
    return this._workerPromise;
  }

  async setTsEditor(editor: monaco.editor.IStandaloneCodeEditor) {
    if (this._tsEditor != null) {
      if (this._tsEditor === editor) {
        return;
      }
      throw new Error("Already have an editor");
    }
    this._tsEditor = editor;
    this._tsEditor.onDidChangeModelContent(() => {
      this._onDidChange.fire();
    });
    const getWorker = await monaco.languages.typescript.getTypeScriptWorker();
    const worker = await getWorker();
    this._worker = worker as unknown as GratsWorker;
    this._resolveWorker(this._worker);
    this._onDidChange.fire();
  }

  async setGratsConfig(
    config: Partial<import("grats").GratsConfig>,
  ): Promise<void> {
    if (config.nullableByDefault !== undefined) {
      this._serializedState.config.nullableByDefault = config.nullableByDefault;
    }
    if (config.reportTypeScriptTypeErrors !== undefined) {
      this._serializedState.config.reportTypeScriptTypeErrors =
        config.reportTypeScriptTypeErrors;
    }
    // TODO: Update serialized state
    const worker = await this.getWorker();
    await worker.setGratsConfig(config);
    this._onDidChange.fire();
  }

  getSerializableState(): SerializableState {
    if (this._tsEditor != null) {
      this._serializedState.doc = this._tsEditor.getValue();
    }
    return this._serializedState;
  }

  getUrlHash(): string {
    const state = this.getSerializableState();
    const hash = "#" + serializeState(state);
    return hash;
    window.history.replaceState(null, "", hash);
  }

  onTSDidChange(cb: () => void): IDisposable {
    return this._onDidChange.event(cb);
  }
}

// See https://github.com/microsoft/monaco-editor/pull/3488
window.MonacoEnvironment = {
  getWorker(workerId, label) {
    switch (label) {
      case "editorWorkerService": {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/editor/editor.worker.js",
            import.meta.url,
          ),
        );
      }

      case "json": {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/json/json.worker.js",
            import.meta.url,
          ),
        );
      }

      case "javascript":
      case "typescript": {
        return new Worker(
          new URL("../../workers/grats.worker.ts", import.meta.url),
        );
      }

      default: {
        throw new Error(`Unsupported worker label: ${label}`);
      }
    }
  },
};

class FormatAdapter implements monaco.languages.DocumentFormattingEditProvider {
  async provideDocumentFormattingEdits(
    model: monaco.editor.ITextModel,
    _options: monaco.languages.FormattingOptions,
    _token: monaco.CancellationToken,
  ): Promise<monaco.languages.TextEdit[]> {
    const worker = await SANDBOX.getWorker();
    const formatted = await worker.format(model.getValue());
    return [{ range: model.getFullModelRange(), text: formatted }];
  }
}

monaco.languages.registerDocumentFormattingEditProvider(
  "typescript",
  new FormatAdapter(),
);

export const SANDBOX = new Sandbox();

SANDBOX.onTSDidChange(() => {
  const hash = SANDBOX.getUrlHash();
  window.history.replaceState(null, "", hash);
});
