import * as ts from "typescript";
import { DocumentNode, Kind, visit } from "graphql";
import { DiagnosticsResult, err, ok } from "../utils/DiagnosticError";
import { TypeContext } from "../TypeContext";

/**
 * During the extraction process when we observe a type reference in a GraphQL
 * position we don't actually resolve that to its GraphQL type name during
 * extraction. Instead we rely on this transform to resolve those references and
 * ensure that they point to `@gql` types.
 */
export function resolveTypes(
  ctx: TypeContext,
  doc: DocumentNode,
): DiagnosticsResult<DocumentNode> {
  const errors: ts.Diagnostic[] = [];
  const newDoc = visit(doc, {
    [Kind.NAME]: (t) => {
      const namedTypeResult = ctx.resolveNamedType(t);
      if (namedTypeResult.kind === "ERROR") {
        errors.push(namedTypeResult.err);
        return t;
      }
      return namedTypeResult.value;
    },
  });
  if (errors.length > 0) {
    return err(errors);
  }
  return ok(newDoc);
}
