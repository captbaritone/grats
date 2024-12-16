import * as path from "path";
import * as fs from "fs";
import * as ts from "typescript";
import {
  DefinitionNode,
  DocumentNode,
  GraphQLError,
  Kind,
  parse,
} from "graphql";
import { TypeContext } from "../TypeContext";
import {
  DiagnosticsWithoutLocationResult,
  graphQlErrorToDiagnostic,
} from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";

export function mergeImportedSchemas(
  ctx: TypeContext,
  doc: DocumentNode,
): DiagnosticsWithoutLocationResult<DocumentNode> {
  const importedSchemas: Set<string> = new Set();
  for (const name of ctx.allNameDefinitions()) {
    if (name.externalImportPath) {
      importedSchemas.add(name.externalImportPath);
    }
  }
  const importedDefinitions: DefinitionNode[] = [];
  const errors: ts.Diagnostic[] = [];
  for (const schemaPath of importedSchemas) {
    const text = fs.readFileSync(path.resolve(schemaPath), "utf-8");
    try {
      const parsedAst = parse(text);
      for (const def of parsedAst.definitions) {
        if (
          def.kind === Kind.OPERATION_DEFINITION ||
          def.kind === Kind.FRAGMENT_DEFINITION ||
          def.kind === Kind.DIRECTIVE_DEFINITION ||
          def.kind === Kind.SCHEMA_DEFINITION ||
          def.kind === Kind.SCHEMA_EXTENSION ||
          def.kind === Kind.SCALAR_TYPE_EXTENSION ||
          def.kind === Kind.INTERFACE_TYPE_EXTENSION ||
          def.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION ||
          def.kind === Kind.UNION_TYPE_EXTENSION ||
          def.kind === Kind.ENUM_TYPE_EXTENSION
        ) {
          continue;
        }
        def.isExternalType = true;
        importedDefinitions.push(def);
      }
    } catch (e) {
      if (e instanceof GraphQLError) {
        errors.push(graphQlErrorToDiagnostic(e));
      }
    }
  }
  if (errors.length > 0) {
    console.log(errors);
    return err(errors);
  }
  const newDoc: DocumentNode = {
    ...doc,
    definitions: [...doc.definitions, ...importedDefinitions],
  };
  return ok(newDoc);
}
