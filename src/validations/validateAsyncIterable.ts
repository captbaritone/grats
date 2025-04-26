import type * as ts from "typescript";
import type {
  DocumentNode,
  FieldDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  TypeNode,
} from "graphql";
import { Kind, visit } from "graphql";
import type { DiagnosticsResult } from "../utils/DiagnosticError.ts";
import { gqlErr } from "../utils/DiagnosticError.ts";
import { err, ok } from "../utils/Result.ts";
import * as E from "../Errors.ts";

/**
 * Ensure that all fields on `Subscription` return an AsyncIterable and transform
 * the return type of subscription fields to not treat AsyncIterable as as list type.
 */
export function validateAsyncIterable(
  doc: DocumentNode,
): DiagnosticsResult<DocumentNode> {
  const errors: ts.DiagnosticWithLocation[] = [];

  const visitNode = {
    enter: (
      t:
        | ObjectTypeDefinitionNode
        | ObjectTypeExtensionNode
        | InterfaceTypeDefinitionNode
        | InterfaceTypeExtensionNode,
    ) => {
      // Note: We assume the default name is used here. When custom operation types are supported
      // we'll need to update this.
      if (t.name.value !== "Subscription") {
        // Don't visit nodes that aren't the Subscription type.
        return false;
      }
    },
  };

  const visitSubscriptionField = (field: FieldDefinitionNode) => {
    const inner = innerType(field.type); // Remove any non-null wrapper types

    if (inner.kind !== Kind.LIST_TYPE || !inner.isAsyncIterable) {
      errors.push(gqlErr(field.type, E.subscriptionFieldNotAsyncIterable()));
      return field;
    }

    const itemType = inner.type;

    // If either field.type or item type is nullable, the field should be nullable
    if (isNullable(field.type) || isNullable(itemType)) {
      const innerInner = innerType(itemType);
      return { ...field, type: innerInner };
    }

    // If _both_ are non-nullable, we will preserve the non-nullability.
    return { ...field, type: itemType };
  };

  const newDoc = visit(doc, {
    [Kind.INTERFACE_TYPE_DEFINITION]: visitNode,
    [Kind.INTERFACE_TYPE_EXTENSION]: visitNode,
    [Kind.OBJECT_TYPE_DEFINITION]: visitNode,
    [Kind.OBJECT_TYPE_EXTENSION]: visitNode,
    [Kind.FIELD_DEFINITION]: visitSubscriptionField,
  });
  if (errors.length > 0) {
    return err(errors);
  }

  return ok(newDoc);
}

function innerType(type: TypeNode): TypeNode {
  if (type.kind === Kind.NON_NULL_TYPE) {
    return innerType(type.type);
  }
  return type;
}

function isNullable(t: TypeNode): boolean {
  return t.kind !== Kind.NON_NULL_TYPE;
}
