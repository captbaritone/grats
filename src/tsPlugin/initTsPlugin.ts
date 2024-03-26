import type * as TS from "typescript/lib/tsserverlibrary";
import { extract } from "../Extractor";
import { FAKE_ERROR_CODE } from "../utils/DiagnosticError";

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

    proxy.getSupportedCodeFixes = (fileName?: string) => {
      info.project.projectService.logger.info(
        `Grats: getSupportedCodeFixes called with ${fileName}`,
      );
      return [
        ...info.languageService.getSupportedCodeFixes(fileName),
        String(FAKE_ERROR_CODE),
      ];
    };

    proxy.getCodeFixesAtPosition = (
      fileName: string,
      start: number,
      end: number,
      errorCodes: readonly number[],
      formatOptions: TS.FormatCodeSettings,
      preferences: TS.UserPreferences,
    ): readonly TS.CodeFixAction[] => {
      info.project.projectService.logger.info(
        `Grats: getCodeFixesAtPosition called with ${fileName} and ${errorCodes}`,
      );
      const prior = info.languageService.getCodeFixesAtPosition(
        fileName,
        start,
        end,
        errorCodes,
        formatOptions,
        preferences,
      );
      const doc = info.languageService.getProgram()?.getSourceFile(fileName);

      if (doc == null) return prior;
      const result = extract(doc);

      if (result.kind === "OK") return prior;

      info.project.projectService.logger.info(
        `Grats: getCodeFixesAtPosition got ${result.err.length} errors in ${fileName}`,
      );
      const relatedDiagnostics = result.err.filter((err) => {
        return (
          err.fix != null &&
          err.start === start &&
          err.length === end - start &&
          err.file.fileName === doc.fileName &&
          errorCodes.includes(err.code)
        );
      });

      info.project.projectService.logger.info(
        `Grats: getCodeFixesAtPosition matched ${relatedDiagnostics.length} errors in ${fileName}`,
      );

      const fixes = relatedDiagnostics.map((err) => {
        return err.fix!;
      });

      return [...prior, ...fixes];
    };

    return proxy;
  }

  return { create };
}
