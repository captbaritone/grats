import { DocumentNode, Kind } from "graphql";
import { DiagnosticsResult, gqlErr } from "../utils/DiagnosticError";
import { ok } from "../utils/Result";
import { DiagnosticWithLocation } from "typescript";
import * as E from "../Errors";

/**
 * Grats depends upon graphql-js for implementing spec-compliant GraphQL schema
 * validation, but there are some cases where Grats could provide a more helpful
 * error message. This validation pass implements those custom validations messages.
 */
export function customSpecValidations(
  documentNode: DocumentNode,
): DiagnosticsResult<DocumentNode> {
  const errors: DiagnosticWithLocation[] = [];
  for (const def of documentNode.definitions) {
    switch (def.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
        if (def.fields == null || def.fields.length === 0) {
          errors.push(
            gqlErr(def.name, E.typeWithNoFields("Type", def.name.value)),
          );
        }
        break;
      case Kind.INTERFACE_TYPE_DEFINITION:
        if (def.fields == null || def.fields.length === 0) {
          errors.push(
            gqlErr(def.name, E.typeWithNoFields("Interface", def.name.value)),
          );
        }
        break;
    }
  }
  if (errors.length > 0) {
    return { kind: "ERROR", err: errors };
  }
  return ok(documentNode);
}
