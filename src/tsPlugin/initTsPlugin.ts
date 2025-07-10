import { version as gratsTsVersion } from "typescript";
// Maybe this should actually be:
// import type * as TS from "typescript/lib/tsserverlibrary";
import type * as TS from "typescript";
import { extract } from "../Extractor.ts";
import { FAKE_ERROR_CODE } from "../utils/DiagnosticError.ts";
import { nullThrows } from "../utils/helpers.ts";

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

    if (ts.version !== gratsTsVersion) {
      proxy.getCompilerOptionsDiagnostics = (): TS.Diagnostic[] => {
        const prev = info.languageService.getCompilerOptionsDiagnostics();
        return [
          ...prev,
          {
            category: ts.DiagnosticCategory.Error,
            code: 0,
            messageText: typeScriptVersionMismatch(ts.version),
            file: undefined,
            start: undefined,
            length: undefined,
          },
        ];
      };
      return proxy;
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
        return nullThrows(err.fix);
      });

      return [...prior, ...fixes];
    };

    return proxy;
  }

  return { create };
}

function typeScriptVersionMismatch(extensionVersion: string) {
  return `grats-plugin-ts error: The version of TypeScript picked up by Grats does not match the version used by VSCode.
Grats is using ${gratsTsVersion} but VSCode is using ${extensionVersion}.
This may be caused by a yarn.lock or package-lock.json which is pinning a different version of TypeScript for Grats than the version used by the rest of your project.
See https://github.com/captbaritone/grats/issues/142> for more information.`;
}
