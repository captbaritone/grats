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
import { err, ok } from "../utils/Result";
import { DiagnosticsResult, tsErr } from "../utils/DiagnosticError";

type Template = {
  declarationTemplate: TypeDefinitionNode;
  genericNodes: Map<ts.EntityName, number>;
  generics: ts.NodeArray<ts.TypeParameterDeclaration>;
};

export function extractGenericTemplates(
  ctx: TypeContext,
  definitions: Array<GratsDefinitionNode>,
): DiagnosticsResult<GratsDefinitionNode[]> {
  const templateExtractor = new TemplateExtractor(ctx);
  const filtered = templateExtractor.extractGenericTemplates(definitions);
  const newDefinitions =
    templateExtractor.materializeGenericTypeReferences(filtered);
  if (templateExtractor._errors.length > 0) {
    return err(templateExtractor._errors);
  }
  return ok(newDefinitions);
}

class TemplateExtractor {
  _templates: Map<ts.Node, Template> = new Map();
  _definitions: Array<GratsDefinitionNode> = [];
  _definedTemplates: Set<string> = new Set();
  _errors: ts.DiagnosticWithLocation[] = [];
  constructor(private ctx: TypeContext) {}

  materializeGenericTypeReferences(
    filtered: Array<GratsDefinitionNode>,
  ): Array<GratsDefinitionNode> {
    filtered.forEach((definition) => {
      if (definition.kind !== "AbstractFieldDefinition") {
        const interpolated = visit(definition, {
          [Kind.NAMED_TYPE]: (node) =>
            this.discoverGenericTypeReferencesInDefinition(node),
        });
        this._definitions.push(interpolated);
      } else {
        this._definitions.push(definition);
      }
    });
    return this._definitions;
  }

  // If a node is a generic type, ensure the type is materialized and derive the canonical name.
  discoverGenericTypeReferencesInDefinition(
    node: NamedTypeNode,
  ): NamedTypeNode | null {
    const referenceNode = this.getReferenceNode(node.name);
    if (referenceNode == null || referenceNode.typeArguments == null) {
      return node;
    }

    const declaration = this.resolveToDeclaration(referenceNode.typeName);

    const template = this._templates.get(declaration);

    if (template == null) {
      return node;
    }

    const args = this.covertTsTypeArgsToGraphQLNames(
      referenceNode.typeArguments,
    );
    if (args == null) return null;
    return this.materializeGenericType(args, template, node);
  }

  materializeGenericType(
    namedTypeArgs: NamedTypeNode[],
    template: Template,
    node: NamedTypeNode,
  ): NamedTypeNode {
    const name = [
      ...namedTypeArgs.map((node) => node.name.value),
      template.declarationTemplate.name.value,
    ].join("");

    const definitionName = { ...node.name, value: name };

    this.materializeTemplate(definitionName, template, namedTypeArgs);

    return { ...node, name: definitionName };
  }

  private covertTsTypeArgsToGraphQLNames(
    typeArguments: ts.NodeArray<ts.TypeNode>,
    templateContext?: {
      template: Template;
      typeArgs: NamedTypeNode[];
    },
  ): NamedTypeNode[] | null {
    const graphQLNames: NamedTypeNode[] = [];
    for (const arg of typeArguments) {
      const gqlName = this.convertTsTypeToGraphQLName(arg, templateContext);
      if (gqlName == null) return null;
      graphQLNames.push(gqlName);
    }
    return graphQLNames;
  }

  convertTsTypeToGraphQLName(
    arg: ts.TypeNode,
    templateContext?: {
      template: Template;
      typeArgs: NamedTypeNode[];
    },
  ): NamedTypeNode | null {
    if (!ts.isTypeReferenceNode(arg)) {
      return this.report(arg, E.invalidTypePassedAsGqlGeneric());
    }

    const symbol = this.ctx.checker.getSymbolAtLocation(arg.typeName);
    if (!symbol) {
      throw new Error(`Could not find symbol for ${arg.getText()}`);
    }
    const declaration = this.ctx.findSymbolDeclaration(symbol);
    if (declaration == null) {
      throw new Error(`Could not find declaration for ${arg.getText()}`);
    }
    const t = this._templates.get(declaration);
    if (t != null) {
      if (arg.typeArguments == null) {
        throw new Error("Expected type arguments when expanding template");
      }
      const tArgs = this.covertTsTypeArgsToGraphQLNames(
        arg.typeArguments,
        templateContext,
      );
      if (tArgs == null) return null;
      // TODO: NEED LOCS
      return this.materializeGenericType(tArgs, t, {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: t.declarationTemplate.name.value,
        },
      });
    }
    if (templateContext != null) {
      const genericIndex = templateContext.template.genericNodes.get(
        arg.typeName,
      );
      if (genericIndex != null) {
        return templateContext.typeArgs[genericIndex];
      }
    }
    const nameDefinition = this.ctx._symbolToName.get(symbol);
    if (nameDefinition == null) {
      throw new Error(`Could not find name for symbol ${symbol.name}`);
    }
    return { kind: Kind.NAMED_TYPE, name: nameDefinition.name };
  }

  materializeTemplate(
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
          // The TS type reference node used to define this type.
          const referenceNode = this.getReferenceNode(node.name);
          if (referenceNode == null) {
            return;
          }
          // The genericNodes map allows us to looking TS type references and
          // see if they point to a generic.
          const genericIndex = template.genericNodes.get(
            referenceNode.typeName,
          );
          if (genericIndex != null) {
            // This is a reference to a generic type. We are currently expanding
            // a template with a set of pre-resolved generics, so we just look up
            // which generic type this reference is and return the corresponding
            return typeArgs[genericIndex];
          }

          // This type is not a generic itself, but it may reference a template

          const declaration = this.resolveToDeclaration(referenceNode.typeName);

          const t = this._templates.get(declaration);
          if (t != null) {
            // This is a template! So we need to expand it.
            // What are the type arguments to this template?
            if (referenceNode.typeArguments == null) {
              throw new Error(
                "Expected type arguments when expanding template",
              );
            }

            // We need to construct the set of GraphQL type nodes that this
            // template will be expanded with.
            const args = this.covertTsTypeArgsToGraphQLNames(
              referenceNode.typeArguments,
              {
                template: template,
                typeArgs,
              },
            );

            if (args == null) return null;

            return this.materializeGenericType(
              // We can't pass these here, because they may reference generic
              // types on the template we are currently expanding.
              args,
              t,
              node,
            );
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
        definition.kind === Kind.UNION_TYPE_DEFINITION ||
        definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
        definition.kind === Kind.INTERFACE_TYPE_DEFINITION
      ) {
        const declaration = this.getNameDeclaration(definition.name);
        // TODO: Handle other types of declarations which have generics.
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
        return true;
      }
      return true;
    });

    return filtered;
  }

  getAsTemplate(
    definition: TypeDefinitionNode,
    generics: ts.NodeArray<ts.TypeParameterDeclaration>,
  ): Template | null {
    const genericNodes = new Map<ts.EntityName, number>();

    const maybeGeneric = (node: ts.TypeReferenceNode) => {
      if (node.typeArguments != null) {
        for (const arg of node.typeArguments) {
          if (ts.isTypeReferenceNode(arg)) {
            maybeGeneric(arg);
          }
        }
      }
      const declaration = this.resolveToDeclaration(node.typeName);

      // If the type points to a type param...
      if (!ts.isTypeParameterDeclaration(declaration)) {
        return;
      }
      // And it's one of our parent type's type params...
      const genericIndex = generics.indexOf(declaration);
      if (genericIndex !== -1) {
        genericNodes.set(node.typeName, genericIndex);
      }
    };
    visit(definition, {
      [Kind.NAMED_TYPE]: (node) => {
        const referenceNode = this.getReferenceNode(node.name);
        if (referenceNode == null) {
          return;
        }
        maybeGeneric(referenceNode);
      },
    });
    if (genericNodes.size === 0) {
      return null;
    }
    return { declarationTemplate: definition, genericNodes, generics };
  }

  // --- Helpers ---

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
    const tsNode = this.ctx._unresolvedNodes.get(name);
    if (!tsNode) {
      // TODO: This means the name did not point to a type reference.
      // Since we only care about potential generics here, we can ignore this.
      // NOTE: There are possibly other nodes that can have type params which
      // should be accounted for. See heritage clauses and type arguments.
      return null;
      throw new Error(`Could not find type node for ${name.value}`);
    }
    return tsNode;
  }

  report(node: ts.Node, message: string): null {
    this._errors.push(tsErr(node, message));
    return null;
  }
}

const E = {
  invalidTypePassedAsGqlGeneric(): string {
    // TODO: Refine this message
    return "Invalid type passed as a generic argument to a GraphQL type.";
  },
};
