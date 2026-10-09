import monaco, { IDisposable, Emitter } from "monaco-editor";
import type { GratsWorker } from "../../workers/grats.worker";
import type { SerializableState } from "./State";
import { serializeState } from "./urlState";
import { getDefaultPlaygroundConfig } from "./State";
import { GRATS_CONFIG_SCHEMA } from "../configSchema";
import lzstring from "lz-string";
import GRATS_TYPE_DECLARATIONS from "!!raw-loader!grats/src/Types.ts";
const GRATS_PATH = "/node_modules/grats/src/index.ts";

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
      // Older URLs hold every option, so drop those left at their defaults.
      const defaults = getDefaultPlaygroundConfig();
      const config: SerializableState["config"] = {};
      for (const [key, value] of Object.entries(state.config ?? {})) {
        if (value !== defaults[key]) {
          config[key] = value;
        }
      }

      return {
        ...DEFAULT_STATE,
        ...state,
        config,
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
    const worker = (await getWorker()) as unknown as GratsWorker;
    await worker.setTsconfigText(this.getTsconfigText());
    this._resolveWorker(worker);
    this._onDidChange.fire();
  }

  /** The playground's tsconfig.json, of which Grats reads the `grats` key. */
  getTsconfigText(): string {
    const config = JSON.stringify(this._serializedState.config, null, 2);
    return [
      "{",
      "  // Grats' options. Inside `grats`, type a quote or press Ctrl+Space to",
      "  // autocomplete them, and hover one to read what it does.",
      `  "grats": ${config.replace(/\n/g, "\n  ")}`,
      "}",
    ].join("\n");
  }

  async setTsconfigText(text: string): Promise<void> {
    const worker = await this.getWorker();
    const config = await worker.setTsconfigText(text);
    // If the text can't be read, Monaco shows why, and the last config holds.
    // Edits which don't change the config, like formatting, change nothing.
    if (
      config == null ||
      JSON.stringify(config) === JSON.stringify(this._serializedState.config)
    ) {
      return;
    }
    this._serializedState.config = config;
    this._onDidChange.fire();
  }

  /** The `grats` key of the playground's tsconfig.json. */
  getConfig(): SerializableState["config"] {
    return this._serializedState.config;
  }

  setOutputOption(
    outputOption: SerializableState["view"]["outputOption"],
  ): void {
    this._serializedState.view.outputOption = outputOption;
    // Only the URL depends on it, so not a change to the code.
    window.history.replaceState(null, "", this.getUrlHash());
  }

  getOutputOption(): SerializableState["view"]["outputOption"] {
    return this._serializedState.view.outputOption;
  }

  getSerializableState(): SerializableState {
    if (this._tsEditor != null) {
      this._serializedState.doc = this._tsEditor.getValue();
    }
    return this._serializedState;
  }

  getUrlHash(): string {
    const state = this.getSerializableState();
    return "#" + serializeState(state);
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

      // Used by GraphiQL, in the playground's execute mode.
      case "graphql": {
        return new Worker(
          new URL("monaco-graphql/esm/graphql.worker.js", import.meta.url),
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

monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
  baseUrl: "./",
  paths: {
    grats: [GRATS_PATH],
  },
});

monaco.languages.typescript.typescriptDefaults.addExtraLib(
  GRATS_TYPE_DECLARATIONS,
  GRATS_PATH,
);

monaco.languages.typescript.typescriptDefaults.addExtraLib(
  `
    export type GraphQLResolveInfo = any;
    export type GraphQLScalarLiteralParser<T> = any;
    export type GraphQLScalarSerializer<T> = any;
    export type GraphQLScalarValueParser<T> = any;
    `,
  "/node_modules/graphql/index.ts",
);

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

class CompletionAdapter implements monaco.languages.CompletionItemProvider {
  _debugDisplayName = "GratsCompletions";
  triggerCharacters = ["@"];
  async provideCompletionItems(
    _model: monaco.editor.ITextModel,
    position: monaco.Position,
    _context: monaco.languages.CompletionContext,
    _token: monaco.CancellationToken,
  ) {
    const worker = await SANDBOX.getWorker();
    return await worker.getTagsAtPosition(position);
  }
}

monaco.languages.registerCompletionItemProvider(
  "typescript",
  new CompletionAdapter(),
);

/** The URI of the playground's tsconfig.json model. */
export const TSCONFIG_URI = "file:///tsconfig.json";

// Grats' options, under the `grats` key of a tsconfig.json. Their schema's
// references are to its root, so its definitions move to the new root.
const { $schema: _, $defs, ...gratsConfigSchema } = GRATS_CONFIG_SCHEMA;
const TSCONFIG_SCHEMA = {
  uri: "https://grats.capt.dev/playground/tsconfig.schema.json",
  fileMatch: [TSCONFIG_URI],
  schema: {
    type: "object",
    $defs,
    properties: { grats: gratsConfigSchema },
    // Like TypeScript, which reads tsconfig.json as JSON with comments.
    allowComments: true,
    allowTrailingCommas: true,
  },
};

/**
 * Validates, and offers completions in, the playground's tsconfig.json.
 * GraphiQL replaces Monaco's JSON options as it loads, before it creates its
 * editors, so this is reapplied whenever an editor is created.
 */
function applyTsconfigSchema(): void {
  const { jsonDefaults } = monaco.languages.json;
  const options = jsonDefaults.diagnosticsOptions;
  // Setting the options restarts Monaco's JSON worker, so only when needed.
  if (options.schemas?.includes(TSCONFIG_SCHEMA)) return;
  jsonDefaults.setDiagnosticsOptions({
    ...options,
    validate: true,
    allowComments: true,
    schemas: [
      ...(options.schemas ?? []).filter(
        (schema) => schema.uri !== TSCONFIG_SCHEMA.uri,
      ),
      TSCONFIG_SCHEMA,
    ],
  });
}

applyTsconfigSchema();
monaco.editor.onDidCreateEditor(applyTsconfigSchema);

export const SANDBOX = new Sandbox();

SANDBOX.onTSDidChange(() => {
  const hash = SANDBOX.getUrlHash();
  window.history.replaceState(null, "", hash);
});
