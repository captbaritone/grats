import {
  ConstObjectFieldNode,
  ConstValueNode,
  DefinitionNode,
  InputObjectTypeDefinitionNode,
  isTypeDefinitionNode,
  Kind,
  ListTypeNode,
  NamedTypeNode,
  TypeNode,
  visit,
} from "graphql";
import { TypeContext } from "../TypeContext";
import { DiagnosticsResult } from "../utils/DiagnosticError";
import { ok } from "../utils/Result";

/**
 * If a string literal default value is used in a position that is typed as a
 * GraphQL enum, replace it with an enum value of the same name.
 *
 * Grats supports modeling enums as a union of string literals. In this case, a
 * possible default input value for an enum would be a string literal. However,
 * in the GraphQL schema we generate we want the default to be repetend as an
 * GraphQL enum, not a string.
 *
 * At extraction time, we are not GraphQL type aware, so we don't know if a
 * string literal in a default position is representing an enum variant or a
 * string literal. Instead, we must do this as a fix-up transform after we have
 * collected all types definitions.
 *
 * Note: If a type-mismatch is encountered the transformation is skipped on the
 * assumption that a later validation pass will detect the error.
 */
export function coerceDefaultEnumValues(
  _ctx: TypeContext,
  definitions: Array<DefinitionNode>,
): DiagnosticsResult<DefinitionNode[]> {
  const coercer = new Coercer(definitions);

  const newDefinitions = definitions.map((def) => {
    return visit(def, {
      [Kind.INPUT_VALUE_DEFINITION](node) {
        if (node.defaultValue == null) {
          return node;
        }
        const coerced = coercer.coerce(node.type, node.defaultValue);
        if (coerced == null) {
          return node;
        }
        return { ...node, defaultValue: coerced };
      },
    });
  });

  return ok(newDefinitions);
}

class Coercer {
  types: Map<string, DefinitionNode>;
  constructor(definitions: DefinitionNode[]) {
    this.types = new Map();
    for (const def of definitions) {
      if (isTypeDefinitionNode(def)) {
        this.types.set(def.name.value, def);
      }
    }
  }
  coerce(parentType: TypeNode, value: ConstValueNode): ConstValueNode {
    switch (parentType.kind) {
      case Kind.NON_NULL_TYPE:
        return this.coerce(parentType.type, value);
      case Kind.NAMED_TYPE:
        return this.coerceNamedType(parentType, value);
      case Kind.LIST_TYPE:
        return this.coerceListType(parentType, value);
      default:
        // @ts-expect-error
        throw new Error(`Unhandled kind ${parentType.kind}`);
    }
  }

  coerceListType(
    parentNamedType: ListTypeNode,
    value: ConstValueNode,
  ): ConstValueNode {
    if (value.kind !== Kind.LIST) return value;

    const newValues: ConstValueNode[] = [];
    for (const v of value.values) {
      const newValue = this.coerce(parentNamedType.type, v);
      newValues.push(newValue ?? v);
    }
    return { ...value, values: newValues };
  }
  coerceNamedType(
    parentNamedType: NamedTypeNode,
    value: ConstValueNode,
  ): ConstValueNode {
    const parentType = this.types.get(parentNamedType.name.value);
    if (parentType == null) return value;

    switch (parentType.kind) {
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        return this.coerceInputObject(parentType, value);
      case Kind.ENUM_TYPE_DEFINITION:
        return this.coerceToEnum(value);
      default:
        return value;
    }
  }

  coerceInputObject(
    parentType: InputObjectTypeDefinitionNode,
    value: ConstValueNode,
  ): ConstValueNode {
    if (value.kind !== Kind.OBJECT) return value;

    const newFields = value.fields.map((field) => {
      const fieldDef = parentType.fields?.find((def) => {
        return def.name.value === field.name.value;
      });
      if (fieldDef == null) return field;

      return this.coerceField(fieldDef.type, field);
    });
    return { ...value, fields: newFields };
  }

  coerceField(
    parentType: TypeNode,
    field: ConstObjectFieldNode,
  ): ConstObjectFieldNode {
    return {
      ...field,
      value: this.coerce(parentType, field.value),
    };
  }

  coerceToEnum(value: ConstValueNode): ConstValueNode {
    switch (value.kind) {
      case Kind.STRING:
        return { ...value, kind: Kind.ENUM, value: value.value };
      default:
        return value;
    }
  }
}

// Note
// We basically need https://github.com/graphql/graphql-js/blob/main/src/utilities/valueToLiteral.ts but that operates on ASTs instead of GraphQLSchema.
