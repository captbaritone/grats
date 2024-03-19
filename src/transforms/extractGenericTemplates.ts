import {
  ASTNode,
  InputObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  Kind,
  NameNode,
  ObjectTypeDefinitionNode,
  TypeDefinitionNode,
  UnionTypeDefinitionNode,
  visit,
} from "graphql";
import { GraphQLConstructor, GratsDefinitionNode } from "../GraphQLConstructor";
import { TypeContext } from "../TypeContext";
import * as ts from "typescript";
import { err, ok } from "../utils/Result";
import { DiagnosticsResult, tsErr } from "../utils/DiagnosticError";
import { extend } from "../utils/helpers";
import * as E from "../Errors";

type Template = {
  declarationTemplate: TypeDefinitionNode;
  typeParameters: ts.NodeArray<ts.TypeParameterDeclaration>;
  genericNodes: Map<ts.EntityName, number>;
};

export function extractGenericTemplates(
  ctx: TypeContext,
  definitions: Array<GratsDefinitionNode>,
): DiagnosticsResult<GratsDefinitionNode[]> {
  const templateExtractor = new TemplateExtractor(ctx);

  return templateExtractor.materializeGenericTypeReferences(definitions);
}

class TemplateExtractor {
  _templates: Map<ts.Node, Template> = new Map();
  _definitions: Array<GratsDefinitionNode> = [];
  _definedTemplates: Set<string> = new Set();
  _errors: ts.DiagnosticWithLocation[] = [];
  gql: GraphQLConstructor;
  constructor(private ctx: TypeContext) {
    this.gql = new GraphQLConstructor();
  }

  materializeGenericTypeReferences(
    definitions: Array<GratsDefinitionNode>,
  ): DiagnosticsResult<Array<GratsDefinitionNode>> {
    // We filter out all template declarations and index them as a first pass.
    const filtered = definitions.filter((definition) => {
      return !this.maybeExtractAsTemplate(definition);
    });

    // Now we can visit the remaining "real" definitions and materialize any
    // generic type references.
    filtered.forEach((definition) => {
      if (definition.kind === "AbstractFieldDefinition") {
        // We can't use the default `visit` function because this is not
        // a GraphQL AST node. Instead, we manually visit the child GraphQL AST
        // nodes within the AbstractFieldDefinition.
        this._definitions.push({
          ...definition,
          onType: this.materializeTemplateForNode(definition.onType),
          field: this.materializeTemplateForNode(definition.field),
        });
      } else {
        this._definitions.push(this.materializeTemplateForNode(definition));
      }
    });

    if (this._errors.length > 0) {
      return err(this._errors);
    }
    return ok(this._definitions);
  }

  materializeTemplateForNode<N extends ASTNode>(node: N): N {
    return visit(node, {
      [Kind.NAME]: (node) => {
        if (node.value !== "__UNRESOLVED_REFERENCE__") {
          return node;
        }
        const referenceNode = this.getReferenceNode(node);
        // TODO: Diagnostic?
        if (referenceNode == null) return node;
        const name = this.resolveTypeReference(referenceNode);
        if (name == null) return node;
        return { ...node, value: name };
      },
    });
  }

  resolveTypeReference(
    node: ts.TypeReferenceNode,
    generics?: Map<ts.Node, string>,
  ): string | null {
    const declaration = this.resolveToDeclaration(node.typeName);
    if (declaration == null) return null;

    if (generics != null) {
      const genericName = generics.get(declaration);
      if (genericName != null) {
        return genericName;
      }
    }

    const template = this._templates.get(declaration);
    if (template != null) {
      const typeArguments = node.typeArguments;
      if (typeArguments == null) {
        // TODO: Message
        return this.report(node, "Missing type arguments for generic");
      }

      // TODO: Make this more efficient?
      const gqlIndexes: number[] = Array.from(template.genericNodes.values());
      gqlIndexes.sort();

      const names: string[] = [];
      for (const index of gqlIndexes) {
        const arg = typeArguments[index];
        if (arg == null) {
          // TODO: Better diagnostic message
          return this.report(node, "Missing type argument for generic");
        }
        if (!ts.isTypeReferenceNode(arg)) {
          return this.report(arg, E.invalidTypePassedAsGqlGeneric());
        }
        const name = this.resolveTypeReference(arg, generics);
        if (name == null) {
          const message = `Could not resolve type reference for ${arg.getText()} with generics ${generics}`;
          throw new Error(message);
          return null;
        }
        names.push(name);
      }

      return this.materializeTemplate(node, names, template);
    }

    const symbol = this.ctx.checker.getSymbolAtLocation(node.typeName);
    if (symbol == null) {
      throw new Error(`Could not find symbol for ${declaration.getText()}`);
    }

    const nameDefinition = this.ctx._symbolToName.get(
      this.ctx.resolveSymbol(symbol),
    );
    if (nameDefinition == null) {
      return this.report(node, E.unresolvedTypeReference());
    }
    return nameDefinition.name.value;
  }

  materializeTemplate(
    referenceLoc: ts.Node,
    typeParams: string[],
    template: Template,
  ): string {
    const derivedName =
      typeParams.join("") + template.declarationTemplate.name.value;
    if (this._definedTemplates.has(derivedName)) return derivedName;
    this._definedTemplates.add(derivedName);

    const genericsContext = new Map<ts.Node, string>();
    for (const i of new Set(template.genericNodes.values())) {
      const name = typeParams[i];
      if (name == null) {
        const message = `Trying to materialize template ${template.declarationTemplate.name.value} with ${typeParams.length} type params, but missing type param at index ${i}`;
        throw new Error(message);
      }
      const param = template.typeParameters[i];
      if (param == null) {
        throw new Error("Type param not found");
      }
      genericsContext.set(param, name);
    }

    const gqlLoc = this.gql._loc(referenceLoc);

    const definition = visit(
      {
        ...template.declarationTemplate,
        loc: gqlLoc,
        name: {
          ...template.declarationTemplate.name,
          loc: gqlLoc,
          value: derivedName,
        },
      },
      {
        [Kind.NAMED_TYPE]: (node) => {
          if (node.name.value !== "__UNRESOLVED_REFERENCE__") {
            return node;
          }
          const referenceNode = this.getReferenceNode(node.name);
          // TODO: Diagnostic?
          if (referenceNode == null) return node;

          const name = this.resolveTypeReference(
            referenceNode,
            genericsContext,
          );

          if (name == null) return node;

          return { ...node, name: { ...node.name, value: name } };
        },
      },
    );

    this._definitions.push(definition);
    return derivedName;
  }

  maybeExtractAsTemplate(definition: GratsDefinitionNode): boolean {
    if (!mayReferenceGenerics(definition)) {
      return false;
    }
    const declaration = this.getNameDeclaration(definition.name);
    const typeParams = getTypeParameters(declaration);

    if (typeParams == null || typeParams.length === 0) {
      return false;
    }

    const genericNodes = new Map<ts.EntityName, number>();

    visit(definition, {
      // TODO: We should only visit types which are in positions where generics are valid:
      // Field types
      [Kind.NAMED_TYPE]: (node) => {
        const referenceNode = this.getReferenceNode(node.name);
        if (referenceNode == null) {
          return;
        }
        const references = findAllReferences(referenceNode);
        for (const reference of references) {
          const declaration = this.resolveToDeclaration(reference.typeName);
          if (declaration == null) return;

          // If the type points to a type param...
          if (!ts.isTypeParameterDeclaration(declaration)) {
            return;
          }
          // And it's one of our parent type's type params...
          const genericIndex = typeParams.indexOf(declaration);
          if (genericIndex !== -1) {
            genericNodes.set(reference.typeName, genericIndex);
          }
        }
      },
    });
    if (genericNodes.size === 0) {
      return false;
    }
    this._templates.set(declaration, {
      declarationTemplate: definition,
      genericNodes,
      typeParameters: typeParams,
    });
    return true;
  }

  // --- Helpers ---

  resolveToDeclaration(node: ts.Node): ts.Declaration | null {
    const symbol = this.ctx.checker.getSymbolAtLocation(node);
    if (!symbol) {
      throw new Error(`Could not find symbol for ${node.getText()}`);
    }
    const declaration = this.ctx.findSymbolDeclaration(symbol);
    if (!declaration) {
      return this.report(node, E.unresolvedTypeReference());
    }
    return declaration;
  }

  getNameDeclaration(name: NameNode): ts.Declaration {
    const tsDefinition = this.ctx._nameToSymbol.get(name.tsIdentifier);
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
    const tsNode = this.ctx._unresolvedNodes.get(name.tsIdentifier);
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

function mayReferenceGenerics(
  definition: GratsDefinitionNode,
): definition is
  | ObjectTypeDefinitionNode
  | UnionTypeDefinitionNode
  | InputObjectTypeDefinitionNode
  | InterfaceTypeDefinitionNode {
  return (
    definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
    definition.kind === Kind.UNION_TYPE_DEFINITION ||
    definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
    definition.kind === Kind.INTERFACE_TYPE_DEFINITION
  );
}

function getTypeParameters(
  declaration: ts.Declaration,
): ts.NodeArray<ts.TypeParameterDeclaration> | null {
  if (ts.isTypeAliasDeclaration(declaration)) {
    return declaration.typeParameters ?? null;
  }
  if (ts.isInterfaceDeclaration(declaration)) {
    return declaration.typeParameters ?? null;
  }
  if (ts.isClassDeclaration(declaration)) {
    return declaration.typeParameters ?? null;
  }
  // TODO: Handle other types of declarations which have generics.
  return null;
}

// Given a type reference, recursively walk its type arguments and return all
// type references in the current.
function findAllReferences(node: ts.TypeReferenceNode): ts.TypeReferenceNode[] {
  const references: ts.TypeReferenceNode[] = [];
  if (node.typeArguments != null) {
    for (const arg of node.typeArguments) {
      if (ts.isTypeReferenceNode(arg)) {
        extend(references, findAllReferences(arg));
      }
    }
  }
  references.push(node);
  return references;
}
