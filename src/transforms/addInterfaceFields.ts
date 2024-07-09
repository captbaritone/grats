import * as E from "../Errors";
import * as ts from "typescript";
import { DefinitionNode, Kind, ObjectTypeExtensionNode } from "graphql";
import { TypeContext } from "../TypeContext";
import {
  DiagnosticResult,
  DiagnosticsResult,
  gqlErr,
  gqlRelated,
} from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";
import { extend, nullThrows } from "../utils/helpers";
import { FIELD_TAG } from "../Extractor";

/**
 * Grats allows you to define GraphQL fields on TypeScript interfaces using
 * function syntax. This means when we extract a function field we don't know
 * yet if it is extending a type or an interface.
 *
 * This transform takes those abstract field definitions, transforms them into
 * either object type extensions or interface type extensions.
 */
export function addInterfaceFields(
  ctx: TypeContext,
  docs: DefinitionNode[],
): DiagnosticsResult<DefinitionNode[]> {
  const errors: ts.DiagnosticWithLocation[] = [];

  const newDocs = docs.map((doc) => {
    if (doc.kind === Kind.OBJECT_TYPE_EXTENSION && doc.mayBeInterface) {
      const abstractDocResults = addAbstractFieldDefinition(ctx, doc);
      if (abstractDocResults.kind === "ERROR") {
        errors.push(abstractDocResults.err);
        return doc;
      } else {
        return abstractDocResults.value;
      }
    } else {
      return doc;
    }
  });
  if (errors.length > 0) {
    return err(errors);
  }
  return ok(newDocs);
}

// A field definition may be on a concrete type, or on an interface. If it's on an interface,
// we need to add it to each concrete type that implements the interface.
function addAbstractFieldDefinition(
  ctx: TypeContext,
  doc: ObjectTypeExtensionNode,
): DiagnosticResult<DefinitionNode> {
  const definitionResult = ctx.gqlNameDefinitionForGqlName(doc.name);

  if (definitionResult.kind === "ERROR") {
    return definitionResult;
  }

  const nameDefinition = definitionResult.value;
  const field = nullThrows(doc.fields?.[0]);

  switch (nameDefinition.kind) {
    case "TYPE":
      return ok({
        kind: Kind.OBJECT_TYPE_EXTENSION,
        name: doc.name,
        fields: [field],
        loc: doc.loc,
      });
    case "INTERFACE": {
      return ok({
        kind: Kind.INTERFACE_TYPE_EXTENSION,
        name: doc.name,
        fields: [field],
        loc: doc.loc,
      });
    }
    default: {
      // Extending any other type of definition is not supported.
      const loc = nullThrows(doc.name.loc);
      const relatedLoc = nullThrows(nameDefinition.name.loc);

      return err(
        gqlErr(loc, E.invalidTypePassedToFieldFunction(), [
          gqlRelated(
            relatedLoc,
            `This is the type that was passed to \`@${FIELD_TAG}\`.`,
          ),
        ]),
      );
    }
  }
}
