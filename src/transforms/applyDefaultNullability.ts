import { DocumentNode, Kind, visit } from "graphql";
import { DiagnosticsResult, gqlErr } from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";
import * as ts from "typescript";
import * as E from "../Errors";
import { KILLS_PARENT_ON_EXCEPTION_DIRECTIVE } from "../metadataDirectives";
import { GraphQLConstructor } from "../GraphQLConstructor";
import { ConfigOptions } from "../gratsConfig";
import { loc } from "../utils/helpers";

/**
 * Grats has options to make all fields nullable by default to conform to
 * GraphQL best practices. This transform applies this option to the schema.
 */
export function applyDefaultNullability(
  doc: DocumentNode,
  { nullableByDefault }: ConfigOptions,
): DiagnosticsResult<DocumentNode> {
  const gql = new GraphQLConstructor();
  const errors: ts.DiagnosticWithLocation[] = [];
  const newDoc = visit(doc, {
    [Kind.FIELD_DEFINITION]: (t) => {
      const killsParent = t.directives?.find(
        (d) => d.name.value === KILLS_PARENT_ON_EXCEPTION_DIRECTIVE,
      );

      if (killsParent) {
        // You can only use @killsParentOnException if nullableByDefault is on.
        if (!nullableByDefault) {
          errors.push(
            gqlErr(loc(killsParent), E.killsParentOnExceptionWithWrongConfig()),
          );
        }
        // You can't use @killsParentOnException if it's been typed as nullable
        if (t.type.kind !== Kind.NON_NULL_TYPE) {
          errors.push(
            gqlErr(loc(killsParent), E.killsParentOnExceptionOnNullable()),
          );
        }
        // Set the location of the NON_NULL_TYPE wrapper to the location of the
        // @killsParentOnException directive so that type errors created by graphql-js
        // are reported at the correct location.
        return { ...t, type: { ...t.type, loc: killsParent.loc } };
      }
      if (nullableByDefault && t.type.kind === Kind.NON_NULL_TYPE) {
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
