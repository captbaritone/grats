import * as ts from "typescript";
import {
  DocumentNode,
  GraphQLSchema,
  visit,
  ValuesOfCorrectTypeRule,
  ValidationContext,
  TypeInfo,
  visitWithTypeInfo,
  GraphQLError,
  getNamedType,
  isScalarType,
} from "graphql";
import {
  DiagnosticsWithoutLocationResult,
  gqlErr,
  gqlRelated,
} from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";
import { nullThrows } from "../utils/helpers";

/**
 * Surprisingly, the GraphQL spec (and therefore graphql-js) does not enforce
 * that the types of arguments passed to directives used within the schema are
 * valid with respect to the directive's schema definition.
 *
 * However, we believe that if Grats knows, or can know, something is invalid at
 * build time it should report that as an error at build time rather than waiting
 * for a runtime error.
 *
 * Therefore, this validation implements the validation which we believe should be
 * part of the GraphQL spec: Enforcing that for every directive used in the schema,
 * its arguments are valid with respect to the directive's schema definition.
 */
export function validateDirectiveArguments(
  schema: GraphQLSchema,
  ast: DocumentNode,
): DiagnosticsWithoutLocationResult<GraphQLSchema> {
  const errors: ts.Diagnostic[] = [];

  const typeInfo = new TypeInfo(schema);

  const onError = (error: GraphQLError) => {
    if (error.nodes == null || error.nodes.length === 0) {
      // Every validation error should have a location to blame to. If not, this
      // is probably some internal error and we should blow up.
      throw error;
    }

    const related: ts.DiagnosticRelatedInformation[] = [];
    const inputType = typeInfo.getInputType();
    if (inputType != null) {
      const inputNamedType = getNamedType(inputType);
      if (!isScalarType(inputNamedType)) {
        const inputTypeAst = nullThrows(inputNamedType.astNode);
        related.push(gqlRelated(inputTypeAst, "Input type defined here"));
      }
    }

    const parentType = typeInfo.getParentInputType();
    if (parentType != null) {
      const parentNamedType = getNamedType(parentType);
      if (!isScalarType(parentNamedType)) {
        const parentTypeAst = nullThrows(parentNamedType.astNode);
        related.push(
          gqlRelated(parentTypeAst, "Parent input type defined here"),
        );
      }
    }

    const fieldType = typeInfo.getFieldDef();
    if (fieldType != null) {
      const fieldTypeAst = nullThrows(fieldType.astNode);
      related.push(gqlRelated(fieldTypeAst, "Directive argument defined here"));
    }

    // Ideally we could include a related code location of the actual field
    // definition, which might be some field on a deeply nested input type.
    // However, it's not possible for us to do that without having our own
    // implementation of parsing a literal to a specific type.

    // For now we'll settle for just including the directive argument location.

    errors.push(gqlErr(error.nodes[0], error.message, related));
  };

  const visitor = ValuesOfCorrectTypeRule(
    new ValidationContext(schema, ast, typeInfo, onError),
  );

  visit(ast, visitWithTypeInfo(typeInfo, visitor));

  if (errors.length > 0) {
    return err(errors);
  }
  return ok(schema);
}
