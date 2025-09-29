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

export const SANDBOX = new Sandbox();
