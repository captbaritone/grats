import { parse } from "@typescript-eslint/parser";
import { traverse, Diagnostic } from "./Traverse";
import { DocumentNode } from "graphql";

export function extract(code: string): DocumentNode {
  const ast = parse(code, {
    comment: true,
    loc: true,
    // Omitting this breaks the scope manager
    range: true,
  });

  const schemaResult = traverse(ast);

  switch (schemaResult.type) {
    case "OK":
      return schemaResult.value;
    case "ERROR":
      reportDiagnostics(code, schemaResult.error);
      throw new Error("There were errors extracting the schema");
  }
}

// Output a code snippet with the error message and location
function reportDiagnostics(text: string, diagnostics: Array<Diagnostic>) {
  const lines = text.split("\n");
  for (const diagnostic of diagnostics) {
    const { line, column } = diagnostic.location.start;
    const lineText = lines[line - 1];
    const lineTextWithPointer = lineText + "\n" + " ".repeat(column) + "^";
    console.log(lineTextWithPointer);
    console.log(diagnostic.message);
  }
}
