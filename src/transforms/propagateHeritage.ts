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
import { DiagnosticsResult } from "../utils/DiagnosticError";
import { ok } from "../utils/Result";
import { extend } from "../utils/helpers";

export function propagateHeritage(
  ctx: TypeContext,
  documentNode: DocumentNode,
): DiagnosticsResult<DocumentNode> {
  const propagator = new HeritagePropagator(ctx, documentNode);
  return propagator.propagateHeritage();
}

class HeritagePropagator {
  constructor(private ctx: TypeContext, private documentNode: DocumentNode) {}

  propagateHeritage(): DiagnosticsResult<DocumentNode> {
    const newDefinitions = this.documentNode.definitions.map((def) => {
      switch (def.kind) {
        case Kind.INTERFACE_TYPE_DEFINITION:
        case Kind.OBJECT_TYPE_DEFINITION: {
          const declaration = this.ctx.tsDeclarationForGqlDefinition(def);
          if (
            ts.isClassDeclaration(declaration) ||
            ts.isInterfaceDeclaration(declaration)
          ) {
            return this.newMethod(def, declaration);
          }
          return def;
        }
        default:
          return def;
      }
    });
    return ok({ ...this.documentNode, definitions: newDefinitions });
  }

  newMethod(
    def: InterfaceTypeDefinitionNode | ObjectTypeDefinitionNode,
    declaration: ts.ClassDeclaration | ts.InterfaceDeclaration,
  ): InterfaceTypeDefinitionNode | ObjectTypeDefinitionNode {
    const name = declaration.name;
    if (name == null) {
      throw new Error("Name is null");
    }
    const symbol = this.ctx.checker.getSymbolAtLocation(name);
    if (symbol == null) {
      throw new Error("Symbol is null");
    }
    const parentTypes = this.getAllParents(symbol);

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

    return {
      ...def,
      interfaces,
      fields: [...(def.fields ?? []), ...fieldsMap.values()],
    };
  }

  getAllParents(symbol: ts.Symbol, parents: Set<NameDefinition> = new Set()) {
    if (symbol.declarations == null) {
      return parents;
    }

    for (const declaration of symbol.declarations) {
      if (
        ts.isClassDeclaration(declaration) ||
        ts.isInterfaceDeclaration(declaration)
      ) {
        if (declaration.heritageClauses != null) {
          for (const heritageClause of declaration.heritageClauses) {
            for (const type of heritageClause.types) {
              const typeSymbol = this.ctx.checker.getSymbolAtLocation(
                type.expression,
              );
              if (typeSymbol != null) {
                if (typeSymbol.declarations != null) {
                  for (const decl of typeSymbol.declarations) {
                    const name = this.ctx._declarationToName.get(decl);
                    if (name != null) {
                      parents.add(name);
                    }
                  }
                }
                this.getAllParents(typeSymbol, parents);
              }
            }
          }
        }
      }
    }
    return parents;
  }

  fieldsForType(name: NameDefinition): FieldDefinitionNode[] {
    const fields: FieldDefinitionNode[] = [];
    for (const def of this.documentNode.definitions) {
      switch (def.kind) {
        case Kind.INTERFACE_TYPE_DEFINITION:
        case Kind.OBJECT_TYPE_DEFINITION: {
          if (def.fields != null && def.name.value === name.name.value) {
            extend(fields, def.fields);
          }
          break;
        }
      }
    }
    return fields;
  }

  interfacesForType(name: NameDefinition): NamedTypeNode[] {
    const interfaces: NamedTypeNode[] = [];
    for (const def of this.documentNode.definitions) {
      switch (def.kind) {
        case Kind.INTERFACE_TYPE_DEFINITION:
        case Kind.OBJECT_TYPE_DEFINITION: {
          if (def.interfaces != null && def.name.value === name.name.value) {
            extend(interfaces, def.interfaces);
          }
          break;
        }
      }
    }
    return interfaces;
  }
}
