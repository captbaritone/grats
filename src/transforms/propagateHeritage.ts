/**
 * If a class or interface extends or implements another class or interface, it
 * should also inherit all of the parent's properties and methods. Note that
 * this is recursive as well.
 */

import * as ts from "typescript";
import {
  DocumentNode,
  FieldDefinitionNode,
  InterfaceTypeDefinitionNode,
  Kind,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
} from "graphql";
import { NameDefinition, TypeContext } from "../TypeContext";
import { nullThrows } from "../utils/helpers";

/**
 * If a class or interface extends or implements another class or interface, we
 * should also (recursively!) inherit all of the parent's GraphQL fields and interfaces.
 *
 * This function adds all fields and interfaces from parent classes and interfaces to the
 * child class or interface.
 */
export function propagateHeritage(
  ctx: TypeContext,
  documentNode: DocumentNode,
): DocumentNode {
  const propagator = new HeritagePropagator(ctx, documentNode);
  return propagator.propagateHeritage();
}

class HeritagePropagator {
  _definitionsByName: Map<
    string,
    InterfaceTypeDefinitionNode | ObjectTypeDefinitionNode
  > = new Map();

  constructor(private ctx: TypeContext, private documentNode: DocumentNode) {
    for (const def of this.documentNode.definitions) {
      switch (def.kind) {
        case Kind.INTERFACE_TYPE_DEFINITION:
        case Kind.OBJECT_TYPE_DEFINITION: {
          this._definitionsByName.set(def.name.value, def);
          break;
        }
      }
    }
  }

  propagateHeritage(): DocumentNode {
    const newDefinitions = this.documentNode.definitions.map((def) => {
      switch (def.kind) {
        case Kind.INTERFACE_TYPE_DEFINITION:
        case Kind.OBJECT_TYPE_DEFINITION: {
          const declaration = this.ctx.tsDeclarationForGqlDefinition(def);
          if (
            ts.isClassDeclaration(declaration) ||
            ts.isInterfaceDeclaration(declaration)
          ) {
            return this.propagateHeritageForDefinition(def, declaration);
          }
          return def;
        }
        default:
          return def;
      }
    });
    return { ...this.documentNode, definitions: newDefinitions };
  }

  propagateHeritageForDefinition(
    def: InterfaceTypeDefinitionNode | ObjectTypeDefinitionNode,
    declaration: ts.ClassDeclaration | ts.InterfaceDeclaration,
  ): InterfaceTypeDefinitionNode | ObjectTypeDefinitionNode {
    const name = nullThrows(declaration.name);
    const parentTypes = this.ctx.getAllParentsForName(name);

    // Build up fields
    const fieldsMap = new Map<string, FieldDefinitionNode>();
    const ownFields = new Set<string>();
    if (def.fields != null) {
      for (const field of def.fields) {
        ownFields.add(field.name.value);
      }
    }
    for (const parent of parentTypes) {
      for (const field of this.fieldsForType(parent)) {
        if (
          !fieldsMap.has(field.name.value) &&
          !ownFields.has(field.name.value)
        ) {
          fieldsMap.set(field.name.value, field);
        }
      }
    }

    // Build up interfaces
    const interfaces = def.interfaces == null ? [] : [...def.interfaces];

    for (const parent of parentTypes) {
      for (const parentInterface of this.interfacesForType(parent)) {
        if (
          !interfaces.some((i) => i.name.value === parentInterface.name.value)
        ) {
          interfaces.push(parentInterface);
        }
      }
    }

    const parentFields = fieldsMap.values();

    const fields =
      def.fields == null ? [...parentFields] : [...def.fields, ...parentFields];

    return { ...def, interfaces, fields };
  }

  fieldsForType(name: NameDefinition): readonly FieldDefinitionNode[] {
    const def = this._definitionsByName.get(name.name.value);
    return def == null ? [] : def.fields ?? [];
  }

  interfacesForType(name: NameDefinition): readonly NamedTypeNode[] {
    const def = this._definitionsByName.get(name.name.value);
    return def == null ? [] : def.interfaces ?? [];
  }
}
