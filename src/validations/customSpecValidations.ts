import type { DocumentNode } from "graphql";
import { Kind } from "graphql";
import type { DiagnosticsResult } from "../utils/DiagnosticError.ts";
import { gqlErr } from "../utils/DiagnosticError.ts";
import { ok } from "../utils/Result.ts";
import type { DiagnosticWithLocation } from "typescript";
import * as E from "../Errors.ts";

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
