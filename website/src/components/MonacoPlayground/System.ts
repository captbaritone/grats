import monaco from "monaco-editor";
import type { GratsWorker } from "../../workers/grats.worker";

export default class System {
  _worker: Promise<GratsWorker>;
  constructor() {
    this._worker = monaco.languages.typescript
      .getTypeScriptWorker()
      .then((getWorker) => {
        // @ts-ignore
        return getWorker() as Promise<GratsWorker>;
      });
  }
}
