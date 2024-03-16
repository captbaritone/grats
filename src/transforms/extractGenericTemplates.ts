import {
  Kind,
  NameNode,
  NamedTypeNode,
  TypeDefinitionNode,
  visit,
} from "graphql";
import { GratsDefinitionNode } from "../GraphQLConstructor";
import { TypeContext } from "../TypeContext";
import * as ts from "typescript";

type Template = {
  declarationTemplate: TypeDefinitionNode;
  genericNodes: Map<NamedTypeNode, number>;
  generics: ts.NodeArray<ts.TypeParameterDeclaration>;
};

export function extractGenericTemplates(
  ctx: TypeContext,
  definitions: Array<GratsDefinitionNode>,
): Array<GratsDefinitionNode> {
  const templateExtractor = new TemplateExtractor(ctx);
  const filtered = templateExtractor.extractGenericTemplates(definitions);
  return templateExtractor.expandFromTemplates(filtered);
}

class TemplateExtractor {
  _templates: Map<ts.Node, Template> = new Map();
  _definitions: Array<GratsDefinitionNode> = [];
  _definedTemplates: Set<string> = new Set();
  constructor(private ctx: TypeContext) {}

  expandFromTemplates(
    filtered: Array<GratsDefinitionNode>,
  ): Array<GratsDefinitionNode> {
    filtered.forEach((definition) => {
      if (definition.kind !== "AbstractFieldDefinition") {
        const interpolated = visit(definition, {
          [Kind.NAMED_TYPE]: (node) => {
            return this.maybeMaterializeType(node);
          },
        });
        this._definitions.push(interpolated);
      } else {
        this._definitions.push(definition);
      }
    });
    return this._definitions;
  }

  // If a node is a generic type, ensure the type is materialized and derive the canonical name.
  maybeMaterializeType(node: NamedTypeNode): NamedTypeNode {
    const referenceNode = this.getReferenceNode(node.name);
    if (referenceNode == null || referenceNode.typeArguments == null) {
      return node;
    }

    const symbol = this.ctx.checker.getSymbolAtLocation(referenceNode.typeName);

    if (!symbol) {
      throw new Error(`Could not find type symbol for ${node.name.value}`);
    }

    // This is where the type reference is declared.
    const declaration = this.ctx.findSymbolDeclaration(symbol);
    if (!declaration) {
      throw new Error(`Could not find declaration for ${node.name.value}`);
    }

    const template = this._templates.get(declaration);

    if (template != null) {
      const namedTypeArgs: NamedTypeNode[] = referenceNode.typeArguments.map(
        (arg) => {
          if (!ts.isTypeReferenceNode(arg)) {
            throw new Error(`Expected type reference node, got ${arg.kind}`);
          }

          const symbol = this.ctx.checker.getSymbolAtLocation(arg.typeName);
          if (!symbol) {
            throw new Error(`Could not find symbol for ${arg.getText()}`);
          }
          const declaration = this.ctx.findSymbolDeclaration(symbol);
          if (declaration == null) {
            throw new Error(`Could not find declaration for ${arg.getText()}`);
          }
          if (this._templates.has(declaration)) {
            throw new Error("TODO: Template referenced as type argument");
          }
          const nameDefinition = this.ctx._symbolToName.get(symbol);
          if (nameDefinition == null) {
            throw new Error(`Could not find name for symbol ${symbol.name}`);
          }
          return { kind: Kind.NAMED_TYPE, name: nameDefinition.name };
        },
      );

      const name = [
        ...namedTypeArgs.map((node) => node.name.value),
        template.declarationTemplate.name.value,
      ].join("");

      const definitionName = { ...node.name, value: name };

      this.expandTemplate(definitionName, template, namedTypeArgs);

      return { ...node, name: definitionName };
    }
    return node;
  }

  expandTemplate(
    name: NameNode,
    template: Template,
    typeArgs: NamedTypeNode[],
  ) {
    if (this._definedTemplates.has(name.value)) {
      return;
    }
    this._definedTemplates.add(name.value); // Add it right away to avoid infinite recursion.
    const definition = { ...template.declarationTemplate, name };
    this._definitions.push(
      visit(definition, {
        [Kind.NAMED_TYPE]: (node) => {
          const genericIndex = template.genericNodes.get(node);
          if (genericIndex != null) {
            return typeArgs[genericIndex];
          }
          return node;
        },
      }),
    );
  }

  extractGenericTemplates(
    definitions: Array<GratsDefinitionNode>,
  ): Array<GratsDefinitionNode> {
    const filtered = definitions.filter((definition) => {
      if (
        definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
        definition.kind === Kind.UNION_TYPE_DEFINITION
      ) {
        const declaration = this.getNameDeclaration(definition.name);
        if (ts.isTypeAliasDeclaration(declaration)) {
          if (declaration.typeParameters == null) {
            return true;
          }
          const genericTemplate = this.getAsTemplate(
            definition,
            declaration.typeParameters,
          );
          if (genericTemplate != null) {
            this._templates.set(declaration, genericTemplate);
          }
          return genericTemplate == null;
        }
        throw new Error(`TODO: Support declaration kind: ${declaration.kind}`);
      }
      return true;
    });

    return filtered;
  }

  getNameDeclaration(name: NameNode): ts.Declaration {
    const tsDefinition = this.ctx._nameToSymbol.get(name);
    if (!tsDefinition) {
      throw new Error(`Could not find type definition for ${name.value}`);
    }
    const declaration = this.ctx.findSymbolDeclaration(tsDefinition);
    if (!declaration) {
      throw new Error(`Could not find declaration for ${name.value}`);
    }
    return declaration;
  }

  getReferenceNode(name: NameNode): ts.TypeReferenceNode | null {
    if (name.value !== "__UNRESOLVED_REFERENCE__") {
      return null;
    }

    // Get the TS Node for this name.
    // Get the name (n1) of this node
    // Get the symbol for n1

    // This is the type reference used in the definition.
    const tsNode = this.ctx._unresolvedNodes.get(name);
    if (!tsNode) {
      throw new Error(`Could not find type node for ${name.value}`);
    }
    return tsNode;
  }

  getAsTemplate(
    definition: TypeDefinitionNode,
    generics: ts.NodeArray<ts.TypeParameterDeclaration>,
  ): Template | null {
    let referencesGeneric = false;
    const genericNodes = new Map<NamedTypeNode, number>();
    const declarationTemplate = visit(definition, {
      [Kind.NAMED_TYPE]: (node) => {
        const referenceNode = this.getReferenceNode(node.name);
        if (referenceNode == null) {
          return node;
        }
        const declaration = this.resolveToDeclaration(referenceNode.typeName);

        // If the type points to a type param...
        if (ts.isTypeParameterDeclaration(declaration)) {
          // And it's one of our parent type's type params...
          const genericIndex = generics.indexOf(declaration);
          if (genericIndex !== -1) {
            genericNodes.set(node, genericIndex);

            referencesGeneric = true;
          }
        }
      },
    });
    if (!referencesGeneric) {
      return null;
    }
    return {
      declarationTemplate,
      genericNodes,
      generics: generics,
    };
  }

  resolveToDeclaration(node: ts.Node): ts.Declaration {
    const symbol = this.ctx.checker.getSymbolAtLocation(node);
    if (!symbol) {
      throw new Error(`Could not find symbol for ${node.getText()}`);
    }
    const declaration = this.ctx.findSymbolDeclaration(symbol);
    if (!declaration) {
      throw new Error(`Could not find declaration for ${node.getText()}`);
    }
    return declaration;
  }
}