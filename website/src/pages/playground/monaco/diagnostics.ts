import { languages } from "monaco-editor";
import { monaco as Monaco } from "react-monaco-editor";
import { FixableDiagnostic } from "../../../../../src/utils/DiagnosticError";

export function codeActionsForDiagnostics(
  text: string,
  model: Monaco.editor.ITextModel,
  diagnostics: FixableDiagnostic[],
): languages.CodeAction[] {
  return diagnostics
    .filter((d) => d.fix != null)
    .flatMap((diagnostic) => {
      if (diagnostic.fix == null) {
        return [];
      }
      const fixName = diagnostic.fix.fixName;
      return diagnostic.fix.changes.flatMap((change) => {
        return change.textChanges.map((textChange) => {
          const range = resolveDiagnosticLocation(
            text,
            textChange.span.start,
            textChange.span.length,
          );
          const textEdit: languages.TextEdit = {
            range,
            text: textChange.newText,
          };

          const edit: languages.IWorkspaceTextEdit = {
            resource: model.uri,
            textEdit,
            versionId: model.getAlternativeVersionId(),
          };
          return {
            title: fixName,
            kind: "quickfix",
            edit: { edits: [edit] },
            isPreferred: true,
          };
        });
      });
    });
}

export function resolveDiagnosticLocation(
  text: string,
  start: number,
  length: number,
): Monaco.Range {
  const lines = text.split("\n");
  let startLine = 0;
  let startColumn = 0;
  let endLine = 0;
  let endColumn = 0;
  let charIndex = 0;
  let lineIndex = 0;

  for (const line of lines) {
    if (charIndex + line.length >= start) {
      startLine = lineIndex + 1;
      startColumn = start - charIndex + 1;
      break;
    }
    charIndex += line.length + 1; // +1 to account for the newline character
    lineIndex += 1;
  }

  lineIndex = 0; // Reset lineIndex but not charIndex
  charIndex = 0;

  for (const line of lines) {
    if (charIndex + line.length >= start + length) {
      endLine = lineIndex + 1;
      endColumn = start + length - charIndex + 1;
      break;
    }
    charIndex += line.length + 1; // +1 to account for the newline character
    lineIndex += 1;
  }

  return new Monaco.Range(startLine, startColumn, endLine, endColumn);
}
