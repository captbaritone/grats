import type * as TS from "typescript/lib/tsserverlibrary";
import { extract } from "../Extractor";

// An experimental plugin for TypeScript that adds a new language service
// which reports diagnostics for the current file. Currently it only reports
// syntax errors because semantic errors are too expensive to compute on each
// keystroke.
export function initTsPlugin(modules: { typescript: typeof TS }) {
  const ts = modules.typescript;

  function create(info: TS.server.PluginCreateInfo): TS.LanguageService {
    const projectRoot = info.project.getCurrentDirectory();
    info.project.projectService.logger.info(
      `Grats: Initializing Plugin with project root: ${projectRoot} and TypeScript version: ${ts.version}`,
    );

    // Set up decorator object
    const proxy: TS.LanguageService = Object.create(null);
    for (const k of Object.keys(info.languageService) as Array<
      keyof TS.LanguageService
    >) {
      const x = info.languageService[k];
      // @ts-expect-error
      proxy[k] = (...args: Array<any>) => x.apply(info.languageService, args);
    }

    proxy.getSyntacticDiagnostics = (filename): TS.DiagnosticWithLocation[] => {
      const prior = info.languageService.getSyntacticDiagnostics(filename);
      const doc = info.languageService.getProgram()?.getSourceFile(filename);

      if (doc == null) return prior;
      const result = extract(doc);

      if (result.kind === "OK") return prior;

      return [...prior, ...result.err];
    };

    return proxy;
  }

  return { create };
}
