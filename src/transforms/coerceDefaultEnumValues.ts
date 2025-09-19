import {
  ConstObjectFieldNode,
  ConstValueNode,
  DefinitionNode,
  EnumTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  isTypeDefinitionNode,
  Kind,
  ListTypeNode,
  NamedTypeNode,
  TypeNode,
  visit,
} from "graphql";
import { TypeContext } from "../TypeContext";

/**
 * This transform visits argument default values checking for values used in
 * enum positions.
 *
 * ## String Literals
 *
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
 * ## Enum Literals
 *
 * If we encountered a TypeScript enum in a default value during extraction
 * (`MyEnum.SomeValue`), we just extract it as an enum `SomeValue`. However,
 * the initializer of that TypeScript enum may be some other name. We need to
 * coerce the default value to the correct enum value.
 *
 * When we record enum value definitions in the schema, we record the TypeScript
 * name of the enum value as `tsName`. This allows us to look up the correct
 * enum value in this transform by visiting each of the enum values and checking
 * if the `tsName` matches the extracted value.
 *
 * Note: If a type-mismatch is encountered the transformation is skipped on the
 * assumption that a later validation pass will detect the error.
 */
export function coerceDefaultEnumValues(
  _ctx: TypeContext,
  definitions: Array<DefinitionNode>,
): DefinitionNode[] {
  const coercer = new Coercer(definitions);

  const newDefinitions = definitions.map((def) => {
    return visit(def, {
      [Kind.INPUT_VALUE_DEFINITION](node) {
        if (node.defaultValue == null) {
          return undefined;
        }
        const coerced = coercer.coerce(node.type, node.defaultValue);
        if (coerced == null) {
          return undefined;
        }
        return { ...node, defaultValue: coerced };
      },
    });
  });

  return newDefinitions;
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
        return this.coerceToEnum(parentType, value);
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
    return { ...field, value: this.coerce(parentType, field.value) };
  }

  coerceToEnum(
    enumDef: EnumTypeDefinitionNode,
    value: ConstValueNode,
  ): ConstValueNode {
    switch (value.kind) {
      case Kind.ENUM:
        if (enumDef.values != null) {
          for (const enumValue of enumDef.values) {
            if (enumValue.tsName === value.value) {
              return { ...value, kind: Kind.ENUM, value: enumValue.name.value };
            }
          }
        }
        return value;
      case Kind.STRING:
        return { ...value, kind: Kind.ENUM, value: value.value };
      default:
        return value;
    }
  }
}
