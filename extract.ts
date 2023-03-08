import { parseForESLint } from "@typescript-eslint/parser";
import { traverse } from "./Traverse";
import { DocumentNode } from "graphql";
import DiagnosticError from "./DiagnosticError";

export function extract(code: string): DocumentNode {
  const { ast, scopeManager } = parseForESLint(code, {
    comment: true,
    loc: true,
    // Omitting this breaks the scope manager
    range: true,
  });

  const schemaResult = traverse(ast, code, scopeManager);

  switch (schemaResult.type) {
    case "OK":
      return schemaResult.value;
    case "ERROR":
      for (const error of schemaResult.error) {
        // TODO: What happened to our prototype?
        console.log(
          DiagnosticError.prototype.asCodeFrame.call(error, code, "dummy.ts"),
        );
      }

      throw new Error("There were errors extracting the schema");
  }
}
