import { DocumentNode, Kind, visit } from "graphql";
import { DiagnosticsResult, err, gqlErr, ok } from "../utils/DiagnosticError";
import * as ts from "typescript";
import * as E from "../Errors";
import { KILLS_PARENT_ON_EXCEPTION_DIRECTIVE } from "../metadataDirectives";
import { GraphQLConstructor } from "../GraphQLConstructor";

export function applyDefaultNullability(
  doc: DocumentNode,
  nullableByDefault: boolean,
): DiagnosticsResult<DocumentNode> {
  const gql = new GraphQLConstructor();
  const errors: ts.DiagnosticWithLocation[] = [];
  const newDoc = visit(doc, {
    [Kind.FIELD_DEFINITION]: (t) => {
      const killsParent = t.directives?.find(
        (d) => d.name.value === KILLS_PARENT_ON_EXCEPTION_DIRECTIVE,
      );

      if (killsParent) {
        if (killsParent.loc == null) {
          throw new Error("Expected killsParent to have a location");
        }
        // You can only use @killsParentOnException if nullableByDefault is on.
        if (!nullableByDefault) {
          this.report(
            killsParent.loc,
            E.killsParentOnExceptionWithWrongConfig(),
          );
        }
        // You can't use @killsParentOnException if it's been typed as nullable
        if (t.type.kind !== Kind.NON_NULL_TYPE) {
          errors.push(
            gqlErr(killsParent.loc, E.killsParentOnExceptionOnNullable()),
          );
        }
        return t;
      }
      if (nullableByDefault) {
        return { ...t, type: gql.nullableType(t.type) };
      }
      return t;
    },
  });
  if (errors.length > 0) {
    return err(errors);
  }
  return ok(newDoc);
}
