/**
 * If a class or interface extends or implements another class or interface, it
 * should also inherit all of the parent's properties and methods. Note that
 * this is recursive as well.
 */

import * as ts from "typescript";
import {
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  Kind,
  NamedTypeNode,
} from "graphql";
import { NameDefinition, TypeContext } from "../TypeContext";
import { DiagnosticsResult } from "../utils/DiagnosticError";
import { ok } from "../utils/Result";
import { extend } from "../utils/helpers";

export function propagateHeritage(
  ctx: TypeContext,
  documentNode: DocumentNode,
): DiagnosticsResult<DocumentNode> {
  function getAllParents(
    symbol: ts.Symbol,
    parents: Set<NameDefinition> = new Set(),
  ) {
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
              const typeSymbol = ctx.checker.getSymbolAtLocation(
                type.expression,
              );
              if (typeSymbol != null) {
                if (typeSymbol.declarations != null) {
                  for (const decl of typeSymbol.declarations) {
                    const name = ctx._declarationToName.get(decl);
                    if (name != null) {
                      parents.add(name);
                    }
                  }
                }
                getAllParents(typeSymbol, parents);
              }
            }
          }
        }
      }
    }
    return parents;
  }

  function fieldsForType(name: NameDefinition): FieldDefinitionNode[] {
    const fields: FieldDefinitionNode[] = [];
    for (const def of documentNode.definitions) {
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

  function interfacesForType(name: NameDefinition): NamedTypeNode[] {
    const interfaces: NamedTypeNode[] = [];
    for (const def of documentNode.definitions) {
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

  const newDefinitions: DefinitionNode[] = [];

  for (const def of documentNode.definitions) {
    switch (def.kind) {
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_DEFINITION: {
        const declaration = ctx.tsDeclarationForGqlDefinition(def);
        if (
          ts.isClassDeclaration(declaration) ||
          ts.isInterfaceDeclaration(declaration)
        ) {
          const name = declaration.name;
          if (name == null) {
            throw new Error("Name is null");
          }
          const symbol = ctx.checker.getSymbolAtLocation(name);
          if (symbol == null) {
            throw new Error("Symbol is null");
          }
          const parentTypes = getAllParents(symbol);

          // Build up fields
          const fieldsMap = new Map<string, FieldDefinitionNode>();
          if (def.fields != null) {
            for (const field of def.fields) {
              fieldsMap.set(field.name.value, field);
            }
          }
          for (const parent of parentTypes) {
            for (const field of fieldsForType(parent)) {
              if (!fieldsMap.has(field.name.value)) {
                fieldsMap.set(field.name.value, field);
              }
            }
          }

          // Build up interfaces

          const interfaces = def.interfaces == null ? [] : [...def.interfaces];

          for (const parent of parentTypes) {
            extend(interfaces, interfacesForType(parent));
          }

          newDefinitions.push({
            ...def,
            interfaces,
            fields: Array.from(fieldsMap.values()),
          });
        } else {
          newDefinitions.push(def);
        }
        break;
      }
      default:
        newDefinitions.push(def);
        break;
    }
  }
  return ok({ ...documentNode, definitions: newDefinitions });
}
