import {
  GraphQLSchema,
  Location,
  resolveSchemaCoordinate,
  type ResolvedSchemaElement,
} from "graphql";
import { Result, err, ok } from "./utils/Result.js";
import { nullThrows } from "./utils/helpers.js";

/**
 * Given a schema coordinate string, locate the entity in the schema
 * and return its source location.
 *
 * Supports all schema coordinate forms:
 * - `Type` — named type
 * - `Type.field` — field on object/interface type
 * - `Type.field(arg:)` — field argument
 * - `EnumType.VALUE` — enum value
 * - `InputType.field` — input field
 * - `@directive` — directive
 * - `@directive(arg:)` — directive argument
 */
export function locate(
  schema: GraphQLSchema,
  coordinate: string,
): Result<Location, string> {
  let resolved: ResolvedSchemaElement | undefined;
  try {
    resolved = resolveSchemaCoordinate(schema, coordinate);
  } catch (e: unknown) {
    return err(
      `Invalid schema coordinate: \`${coordinate}\`. ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (resolved == null) {
    return err(`Could not resolve schema coordinate: \`${coordinate}\`.`);
  }

  switch (resolved.kind) {
    case "NamedType": {
      const astNode = resolved.type.astNode;
      if (astNode == null) {
        throw new Error(
          `Grats bug: Cannot find location of type in coordinate \`${coordinate}\`.`,
        );
      }
      return ok(nullThrows(astNode.name.loc));
    }
    case "Field": {
      const astNode = resolved.field.astNode;
      if (astNode == null) {
        throw new Error(
          `Grats bug: Cannot find location of field in coordinate \`${coordinate}\`.`,
        );
      }
      return ok(nullThrows(astNode.name.loc));
    }
    case "InputField": {
      const astNode = resolved.inputField.astNode;
      if (astNode == null) {
        throw new Error(
          `Grats bug: Cannot find location of input field in coordinate \`${coordinate}\`.`,
        );
      }
      return ok(nullThrows(astNode.name.loc));
    }
    case "EnumValue": {
      const astNode = resolved.enumValue.astNode;
      if (astNode == null) {
        throw new Error(
          `Grats bug: Cannot find location of enum value in coordinate \`${coordinate}\`.`,
        );
      }
      return ok(nullThrows(astNode.name.loc));
    }
    case "FieldArgument": {
      const astNode = resolved.fieldArgument.astNode;
      if (astNode == null) {
        throw new Error(
          `Grats bug: Cannot find location of field argument in coordinate \`${coordinate}\`.`,
        );
      }
      return ok(nullThrows(astNode.name.loc));
    }
    case "Directive": {
      const astNode = resolved.directive.astNode;
      if (astNode == null) {
        throw new Error(
          `Grats bug: Cannot find location of directive in coordinate \`${coordinate}\`.`,
        );
      }
      return ok(nullThrows(astNode.name.loc));
    }
    case "DirectiveArgument": {
      const astNode = resolved.directiveArgument.astNode;
      if (astNode == null) {
        throw new Error(
          `Grats bug: Cannot find location of directive argument in coordinate \`${coordinate}\`.`,
        );
      }
      return ok(nullThrows(astNode.name.loc));
    }
    default: {
      // Exhaustive check — if new schema coordinate kinds are added,
      // TypeScript will catch this.
      const _exhaustive: never = resolved;
      throw new Error(
        `Grats bug: Unexpected schema coordinate kind: ${(resolved as { kind: string }).kind}`,
      );
    }
  }
}
