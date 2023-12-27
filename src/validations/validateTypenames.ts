import * as ts from "typescript";
import { GraphQLSchema, isAbstractType, isType } from "graphql";
import {
  DiagnosticsWithoutLocationResult,
  gqlErr,
} from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";

/**
 * Ensure that every type which implements an interface or is a member of a
 * union has a __typename field.
 */
export function validateTypenames(
  schema: GraphQLSchema,
  hasTypename: Set<string>,
): DiagnosticsWithoutLocationResult<GraphQLSchema> {
  const typenameDiagnostics: ts.Diagnostic[] = [];
  const abstractTypes = Object.values(schema.getTypeMap()).filter(
    isAbstractType,
  );
  for (const type of abstractTypes) {
    // TODO: If we already implement resolveType, we don't need to check implementors

    const typeImplementors = schema.getPossibleTypes(type).filter(isType);
    for (const implementor of typeImplementors) {
      if (!hasTypename.has(implementor.name)) {
        const loc = implementor.astNode?.name?.loc;
        if (loc == null) {
          throw new Error(
            `Grats expected the parsed type \`${implementor.name}\` to have location information. This is a bug in Grats. Please report it.`,
          );
        }
        typenameDiagnostics.push(
          gqlErr(
            loc,
            `Missing __typename on \`${implementor.name}\`. The type \`${type.name}\` is used in a union or interface, so it must have a \`__typename\` field.`,
          ),
        );
      }
    }
  }
  if (typenameDiagnostics.length > 0) {
    return err(typenameDiagnostics);
  }
  return ok(schema);
}
