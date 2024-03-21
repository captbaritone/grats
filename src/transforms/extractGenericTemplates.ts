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
import {
  DiagnosticResult,
  DiagnosticsResult,
  tsErr,
} from "../utils/DiagnosticError";
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
          onType: this.materializeTemplatesForNode(definition.onType),
          field: this.materializeTemplatesForNode(definition.field),
        });
      } else {
        this._definitions.push(this.materializeTemplatesForNode(definition));
      }
    });

    if (this._errors.length > 0) {
      return err(this._errors);
    }
    return ok(this._definitions);
  }

  materializeTemplatesForNode<N extends ASTNode>(node: N): N {
    return visit(node, {
      [Kind.NAME]: (node) => {
        const referenceNode = this.getReferenceNode(node);
        if (referenceNode == null) return node;
        const name = this.resolveTypeReferenceOrReport(referenceNode);
        if (name == null) return node;
        return { ...node, value: name };
      },
    });
  }

  resolveTypeReferenceOrReport(
    node: ts.TypeReferenceNode,
    generics?: Map<ts.Node, string>,
  ): string | null {
    const declaration = this.asNullable(
      this.ctx.tsDeclarationForTsName(node.typeName),
    );
    if (declaration == null) return null;

    if (generics != null) {
      const genericName = generics.get(declaration);
      if (genericName != null) {
        return genericName;
      }
    }

    const template = this._templates.get(declaration);
    if (template != null) {
      const templateName = template.declarationTemplate.name.value;
      const typeArguments = node.typeArguments ?? [];

      const genericIndexes = new Map();
      for (const [node, index] of template.genericNodes) {
        genericIndexes.set(index, node);
      }

      const names: string[] = [];
      for (let i = 0; i < template.typeParameters.length; i++) {
        const exampleGenericNode = genericIndexes.get(i);
        if (exampleGenericNode == null) {
          continue;
        }
        const param = template.typeParameters[i];
        const paramName = param.name.text;
        const arg = typeArguments[i];
        if (arg == null) {
          return this.report(
            node,
            E.missingGenericType(templateName, paramName),
            [
              tsErr(param, `Type parameter \`${paramName}\` is defined here`),
              tsErr(
                exampleGenericNode,
                `and expects a GraphQL type because it was used in a GraphQL position here.`,
              ),
            ],
          );
        }
        if (!ts.isTypeReferenceNode(arg)) {
          return this.report(
            node,
            E.nonGraphQLGenericType(templateName, paramName),
            [
              tsErr(param, `Type parameter \`${paramName}\` is defined here`),
              tsErr(
                exampleGenericNode,
                `and expects a GraphQL type because it was used in a GraphQL position here.`,
              ),
            ],
          );
        }
        const name = this.resolveTypeReferenceOrReport(arg, generics);
        // resolveTypeReference will report an error if the definition is not found.
        if (name == null) return null;
        names.push(name);
      }

      return this.materializeTemplate(node, names, template);
    }
    const nameResult = this.ctx.gqlNameForTsName(node.typeName);

    return this.asNullable(nameResult);
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
        throw new Error(
          "Previous checks should have ensured we have a param name.",
        );
      }
      const param = template.typeParameters[i];
      if (param == null) {
        throw new Error(
          "Previous checks should have ensured we have a param definition.",
        );
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
          const referenceNode = this.getReferenceNode(node.name);
          if (referenceNode == null) return node;

          const name = this.resolveTypeReferenceOrReport(
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
    const declaration = this.ctx.tsDeclarationForGqlDefinition(definition);
    const typeParams = getTypeParameters(declaration);

    if (typeParams == null || typeParams.length === 0) {
      return false;
    }

    const genericNodes = new Map<ts.EntityName, number>();

    visit(definition, {
      [Kind.NAMED_TYPE]: (node) => {
        const referenceNode = this.getReferenceNode(node.name);
        if (referenceNode == null) return;
        const references = findAllReferences(referenceNode);
        for (const reference of references) {
          const declarationResult = this.ctx.tsDeclarationForTsName(
            reference.typeName,
          );
          if (declarationResult.kind === "ERROR") {
            this._errors.push(declarationResult.err);
            return;
          }
          const declaration = declarationResult.value;

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

  getReferenceNode(name: NameNode): ts.TypeReferenceNode | null {
    const node = this.ctx.getEntityName(name);
    if (node == null || !ts.isTypeReferenceNode(node.parent)) return null;
    return node.parent;
  }

  asNullable<T>(result: DiagnosticResult<T>): T | null {
    if (result.kind === "ERROR") {
      this._errors.push(result.err);
      return null;
    }
    return result.value;
  }

  report(
    node: ts.Node,
    message: string,
    relatedInformation?: ts.DiagnosticRelatedInformation[],
  ): null {
    this._errors.push(tsErr(node, message, relatedInformation));
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
