import type * as ts from "typescript";
import type { ConstDirectiveNode, GraphQLField, GraphQLSchema } from "graphql";
import { isInterfaceType } from "graphql";
import { gqlErr, gqlRelated } from "../utils/DiagnosticError.ts";
import type { DiagnosticsWithoutLocationResult } from "../utils/DiagnosticError.ts";
import { err, ok } from "../utils/Result.ts";
import type { GratsConfig } from "../gratsConfig.ts";
import { SEMANTIC_NON_NULL_DIRECTIVE } from "../publicDirectives.ts";
import { astNode } from "../utils/helpers.ts";

/**
 * Ensure that all semantically non-nullable fields on an interface are also
 * semantically non-nullable on all implementors.
 */
export function validateSemanticNullability(
  schema: GraphQLSchema,
  config: GratsConfig,
): DiagnosticsWithoutLocationResult<GraphQLSchema> {
  if (!config.strictSemanticNullability) {
    return ok(schema);
  }
  const errors: ts.Diagnostic[] = [];
  const interfaces = Object.values(schema.getTypeMap()).filter(isInterfaceType);
  for (const interfaceType of interfaces) {
    const typeImplementors = schema.getPossibleTypes(interfaceType);

    // For every field on the interface...
    for (const interfaceField of Object.values(interfaceType.getFields())) {
      if (astNode(interfaceField).type.kind === "NonNullType") {
        // Type checking of non-null types is handled by graphql-js. If this field is non-null,
        // then validation has already asserted that all implementors are non-null meaning no
        // "semantic" non-null types can be present.
        continue;
      }

      const interfaceSemanticNonNull = findSemanticNonNull(interfaceField);
      if (interfaceSemanticNonNull == null) {
        // It's fine for implementors to be more strict, since they are still
        // covariant with the less strict interface.
        continue;
      }

      for (const implementor of typeImplementors) {
        const implementorField = implementor.getFields()[interfaceField.name];
        if (implementorField == null) {
          throw new Error(
            "Expected implementorField to be defined. We expected this to be caught by graphql-js validation. This is a bug in Grats. Please report it.",
          );
        }
        const typeSemanticNonNull = findSemanticNonNull(implementorField);

        if (typeSemanticNonNull == null) {
          errors.push(
            gqlErr(
              interfaceSemanticNonNull,
              `Interface field \`${implementor.name}.${implementorField.name}\` expects a non-nullable type but \`${interfaceType.name}.${interfaceField.name}\` is nullable.`,
              [gqlRelated(astNode(implementorField).type, "Related location")],
            ),
          );
        }
      }
    }
  }
  if (errors.length > 0) {
    return err(errors);
  }
  return ok(schema);
}

function findSemanticNonNull(
  field: GraphQLField<unknown, unknown>,
): ConstDirectiveNode | null {
  return (
    astNode(field).directives?.find(
      (d) => d.name.value === SEMANTIC_NON_NULL_DIRECTIVE,
    ) ?? null
  );
}
