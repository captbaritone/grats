import type * as ts from "typescript";
import { Kind, isAbstractType, isType, GraphQLInterfaceType } from "graphql";
import type { GraphQLSchema } from "graphql";
import type { DiagnosticsWithoutLocationResult } from "../utils/DiagnosticError.ts";
import { gqlErr, gqlRelated } from "../utils/DiagnosticError.ts";
import { err, ok } from "../utils/Result.ts";
import { nullThrows } from "../utils/helpers.ts";
import * as E from "../Errors.ts";

/**
 * Ensure that every type which implements an interface or is a member of a
 * union has a __typename field.
 */
export function validateTypenames(
  schema: GraphQLSchema,
  hasTypename: Set<string>,
): DiagnosticsWithoutLocationResult<GraphQLSchema> {
  const errors: ts.Diagnostic[] = [];
  const abstractTypes = Object.values(schema.getTypeMap()).filter(
    isAbstractType,
  );
  for (const type of abstractTypes) {
    const typeImplementors = schema.getPossibleTypes(type).filter(isType);
    for (const implementor of typeImplementors) {
      const ast = nullThrows(implementor.astNode);
      // Synthesized type cannot guarantee that they have the correct __typename field, so we
      // prevent their use in interfaces and unions.
      if (ast.kind === Kind.OBJECT_TYPE_DEFINITION && ast.wasSynthesized) {
        const message =
          type instanceof GraphQLInterfaceType
            ? E.genericTypeImplementsInterface()
            : E.genericTypeUsedAsUnionMember();
        errors.push(gqlErr(ast.name, message));
      } else if (!hasTypename.has(implementor.name) && ast.exported == null) {
        const message =
          type instanceof GraphQLInterfaceType
            ? E.concreteTypenameImplementingInterfaceCannotBeResolved(
                implementor.name,
                type.name,
              )
            : E.concreteTypenameInUnionCannotBeResolved(
                implementor.name,
                type.name,
              );

        const err = gqlErr(ast.name, message, [
          gqlRelated(
            nullThrows(type.astNode).name,
            `${type.name} is defined here:`,
          ),
        ]);
        errors.push(err);
      }
    }
  }
  if (errors.length > 0) {
    return err(errors);
  }
  return ok(schema);
}
