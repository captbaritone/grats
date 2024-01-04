import * as ts from "typescript";
import {
  DocumentNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  Kind,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  visit,
} from "graphql";
import { DiagnosticsResult, gqlErr } from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";
import * as E from "../Errors";
import { ASYNC_ITERABLE_TYPE_DIRECTIVE } from "../metadataDirectives";
import { loc } from "../utils/helpers";

/**
 * Ensure that all fields on `Subscription` return an AsyncIterable, and that no other
 * fields do.
 */
export function validateAsyncIterable(
  doc: DocumentNode,
): DiagnosticsResult<DocumentNode> {
  const errors: ts.DiagnosticWithLocation[] = [];

  const visitNode = (
    t:
      | ObjectTypeDefinitionNode
      | ObjectTypeExtensionNode
      | InterfaceTypeDefinitionNode
      | InterfaceTypeExtensionNode,
  ) => {
    const validateFieldsResult = validateField(t);
    if (validateFieldsResult != null) {
      errors.push(validateFieldsResult);
    }
  };

  visit(doc, {
    [Kind.INTERFACE_TYPE_DEFINITION]: visitNode,
    [Kind.INTERFACE_TYPE_EXTENSION]: visitNode,
    [Kind.OBJECT_TYPE_DEFINITION]: visitNode,
    [Kind.OBJECT_TYPE_EXTENSION]: visitNode,
  });
  if (errors.length > 0) {
    return err(errors);
  }
  return ok(doc);
}

function validateField(
  t:
    | ObjectTypeDefinitionNode
    | ObjectTypeExtensionNode
    | InterfaceTypeDefinitionNode
    | InterfaceTypeExtensionNode,
): ts.DiagnosticWithLocation | void {
  if (t.fields == null) return;
  // Note: We assume the default name is used here. When custom operation types are supported
  // we'll need to update this.
  const isSubscription =
    t.name.value === "Subscription" &&
    (t.kind === Kind.OBJECT_TYPE_DEFINITION ||
      t.kind === Kind.OBJECT_TYPE_EXTENSION);
  for (const field of t.fields) {
    const asyncDirective = field.directives?.find(
      (directive) => directive.name.value === ASYNC_ITERABLE_TYPE_DIRECTIVE,
    );

    if (isSubscription && asyncDirective == null) {
      return gqlErr(loc(field.type), E.subscriptionFieldNotAsyncIterable());
    }

    if (!isSubscription && asyncDirective != null) {
      if (asyncDirective.loc == null) {
        throw new Error("Expected asyncDirective to have a location.");
      }
      return gqlErr(
        loc(asyncDirective), // Directive location is the AsyncIterable type.
        E.nonSubscriptionFieldAsyncIterable(),
      );
    }
  }
}
