import monaco, { IDisposable, Emitter } from "monaco-editor";
import type { GratsWorker } from "../../workers/grats.worker";

export default class Sandbox {
  _tsEditor: monaco.editor.IStandaloneCodeEditor | null = null;
  _resolveWorker: (worker: GratsWorker) => void = () => {};
  _workerPromise: Promise<GratsWorker>;
  _worker: GratsWorker | null = null;
  _onDidChange = new Emitter<void>();
  constructor() {
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
    const worker = this._worker ?? (await this._workerPromise);
    await worker.setGratsConfig(config);
    this._onDidChange.fire();
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
