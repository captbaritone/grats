import * as path from "path";
import * as fs from "fs";
import * as ts from "typescript";
import {
  DocumentNode,
  GraphQLError,
  isTypeDefinitionNode,
  Kind,
  parse,
} from "graphql";
import { TypeContext } from "../TypeContext";
import {
  DiagnosticsWithoutLocationResult,
  graphQlErrorToDiagnostic,
} from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";

export function addImportedSchemas(
  ctx: TypeContext,
  doc: DocumentNode,
): DiagnosticsWithoutLocationResult<{
  gratsDoc: DocumentNode;
  externalDocs: DocumentNode[];
}> {
  const importedSchemas: Set<string> = new Set();
  for (const name of ctx.allNameDefinitions()) {
    if (name.externalImportPath) {
      importedSchemas.add(name.externalImportPath);
    }
  }
  const externalDocs: DocumentNode[] = [];
  const errors: ts.Diagnostic[] = [];
  for (const schemaPath of importedSchemas) {
    const text = fs.readFileSync(path.resolve(schemaPath), "utf-8");
    try {
      const parsedAst = parse(text);
      externalDocs.push({
        kind: Kind.DOCUMENT,
        definitions: parsedAst.definitions.map((def) => {
          if (isTypeDefinitionNode(def)) {
            return {
              ...def,
              isExternalType: true,
            };
          } else {
            return def;
          }
        }),
      });
    } catch (e) {
      if (e instanceof GraphQLError) {
        errors.push(graphQlErrorToDiagnostic(e));
      }
    }
  }
  if (errors.length > 0) {
    return err(errors);
  }
  return ok({
    gratsDoc: doc,
    externalDocs,
  });
}
