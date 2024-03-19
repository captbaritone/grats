import * as E from "../Errors";
import * as ts from "typescript";
import { DefinitionNode, Kind } from "graphql";
import { TypeContext } from "../TypeContext";
import {
  DiagnosticsResult,
  gqlErr,
  gqlRelated,
} from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";
import { InterfaceMap, computeInterfaceMap } from "../InterfaceGraph";
import { extend, uniqueId } from "../utils/helpers";
import { FIELD_TAG } from "../Extractor";
import {
  AbstractFieldDefinitionNode,
  GratsDefinitionNode,
} from "../GraphQLConstructor";
import { FIELD_METADATA_DIRECTIVE } from "../metadataDirectives";

/**
 * Grats allows you to define GraphQL fields on TypeScript interfaces using
 * function syntax. This allows you to define a shared implementation for
 * all types that implement the interface.
 *
 * This transform takes those abstract field definitions, and adds them to
 * the concrete types that implement the interface.
 */
export function addInterfaceFields(
  ctx: TypeContext,
  docs: GratsDefinitionNode[],
): DiagnosticsResult<DefinitionNode[]> {
  const newDocs: DefinitionNode[] = [];
  const errors: ts.DiagnosticWithLocation[] = [];

  const interfaceGraph = computeInterfaceMap(ctx, docs);

  for (const doc of docs) {
    if (doc.kind === "AbstractFieldDefinition") {
      const abstractDocResults = addAbstractFieldDefinition(
        ctx,
        doc,
        interfaceGraph,
      );
      if (abstractDocResults.kind === "ERROR") {
        extend(errors, abstractDocResults.err);
      } else {
        extend(newDocs, abstractDocResults.value);
      }
    } else {
      newDocs.push(doc);
    }
  }
  if (errors.length > 0) {
    return err(errors);
  }
  return ok(newDocs);
}

// A field definition may be on a concrete type, or on an interface. If it's on an interface,
// we need to add it to each concrete type that implements the interface.
function addAbstractFieldDefinition(
  ctx: TypeContext,
  doc: AbstractFieldDefinitionNode,
  interfaceGraph: InterfaceMap,
): DiagnosticsResult<DefinitionNode[]> {
  const newDocs: DefinitionNode[] = [];
  const definitionResult = ctx.getNameDefinition(doc.onType);

  if (definitionResult.kind === "ERROR") {
    return definitionResult;
  }

  const nameDefinition = definitionResult.value;

  switch (nameDefinition.kind) {
    case "TYPE":
      // Extending a type, is just adding a field to it.
      newDocs.push({
        kind: Kind.OBJECT_TYPE_EXTENSION,
        name: doc.onType,
        fields: [doc.field],
        loc: doc.loc,
      });
      break;
    case "INTERFACE": {
      // Extending an interface is a bit more complicated. We need to add the field
      // to the interface, and to each type that implements the interface.

      // The interface field definition is not executable, so we don't
      // need to annotate it with the details of the implementation.
      const directives = doc.field.directives?.filter((directive) => {
        return directive.name.value !== FIELD_METADATA_DIRECTIVE;
      });
      newDocs.push({
        kind: Kind.INTERFACE_TYPE_EXTENSION,
        name: doc.onType,
        fields: [{ ...doc.field, directives }],
      });

      for (const implementor of interfaceGraph.get(nameDefinition.name.value)) {
        const name = {
          kind: Kind.NAME,
          value: implementor.name,
          loc: doc.loc, // Bit of a lie, but I don't see a better option.
          tsIdentifier: uniqueId(),
        } as const;
        switch (implementor.kind) {
          case "TYPE":
            newDocs.push({
              kind: Kind.OBJECT_TYPE_EXTENSION,
              name,
              fields: [doc.field],
              loc: doc.loc,
            });
            break;
          case "INTERFACE":
            newDocs.push({
              kind: Kind.INTERFACE_TYPE_EXTENSION,
              name,
              fields: [{ ...doc.field, directives }],
              loc: doc.loc,
            });
            break;
        }
      }
      break;
    }
    default: {
      // Extending any other type of definition is not supported.
      const loc = doc.onType.loc;
      if (loc == null) {
        throw new Error("Expected onType to have a location.");
      }
      const relatedLoc = nameDefinition.name.loc;
      if (relatedLoc == null) {
        throw new Error("Expected nameDefinition to have a location.");
      }

      return err([
        gqlErr(loc, E.invalidTypePassedToFieldFunction(), [
          gqlRelated(
            relatedLoc,
            `This is the type that was passed to \`@${FIELD_TAG}\`.`,
          ),
        ]),
      ]);
    }
  }
  return ok(newDocs);
}
