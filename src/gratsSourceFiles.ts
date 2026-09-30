import * as ts from "typescript";
import { ParsedCommandLineGrats } from "./gratsConfig.js";
import { DiagnosticsWithoutLocationResult } from "./utils/DiagnosticError.js";
import { err, ok } from "./utils/Result.js";
import { extend } from "./utils/helpers.js";

const TAG_REGEX = /@(gql)|(killsParentOnException)/i;

// Given a ts.Program, find the files to extract GraphQL definitions from.
// In the future this part might be able to be incremental, were we only run extraction
// on changed files.
export function gratsSourceFilesFromProgram(
  program: ts.Program,
  options: ParsedCommandLineGrats,
): DiagnosticsWithoutLocationResult<ts.SourceFile[]> {
  const errors: ts.DiagnosticWithLocation[] = [];
  const gratsSourceFiles = program.getSourceFiles().filter((sourceFile) => {
    // If the file doesn't contain any GraphQL definitions, skip it.
    if (!TAG_REGEX.test(sourceFile.text)) {
      return false;
    }

    if (options.raw.grats.reportTypeScriptTypeErrors) {
      // If the user asked for us to report TypeScript errors, then we'll report them.
      const typeErrors = ts.getPreEmitDiagnostics(program, sourceFile);
      if (typeErrors.length > 0) {
        extend(errors, typeErrors);
        return false;
      }
    } else {
      // Otherwise, we will only report syntax errors, since they will prevent us from
      // extracting any GraphQL definitions.
      const syntaxErrors = program.getSyntacticDiagnostics(sourceFile);
      if (syntaxErrors.length > 0) {
        // It's not very helpful to report multiple syntax errors, so just report
        // the first one.
        errors.push(syntaxErrors[0]);
        return false;
      }
    }
    return true;
  });

  if (errors.length > 0) {
    return err(errors);
  }

  return ok(gratsSourceFiles);
}
