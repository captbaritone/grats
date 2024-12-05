import {
  ASTNode,
  DefinitionNode,
  InputObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  Kind,
  Location,
  NameNode,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  TypeDefinitionNode,
  UnionTypeDefinitionNode,
  visit,
} from "graphql";
import { loc } from "../GraphQLConstructor";
import { TypeContext } from "../TypeContext";
import * as ts from "typescript";
import { err, ok } from "../utils/Result";
import {
  DiagnosticResult,
  DiagnosticsResult,
  TsLocatableNode,
  gqlErr,
  tsErr,
} from "../utils/DiagnosticError";
import { extend, nullThrows } from "../utils/helpers";
import * as E from "../Errors";
import { METADATA_INPUT_NAMES } from "../metadataDirectives";

type Template = {
  declarationTemplate: TypeDefinitionNode;
  typeParameters: ts.NodeArray<ts.TypeParameterDeclaration>;
  genericNodes: Map<ts.EntityName, number>;
};

/**
 * During extraction we are operating purely syntactically, so we don't actually know
 * which types are being referred to. This function resolves those references.
 *
 * It also materializes any generic type references into concrete types.
 */
export function resolveTypes(
  ctx: TypeContext,
  definitions: Array<DefinitionNode>,
): DiagnosticsResult<DefinitionNode[]> {
  const templateExtractor = new TemplateExtractor(ctx);
  return templateExtractor.materializeGenericTypeReferences(definitions);
}

/**
 * Template extraction happens in two phases and resolves named type references
 * as a side effect.
 *
 * 1. We walk all declarations checking if they contain type references in
 * GraphQL positions which point back to the declaration's type parameters. If
 * so, they are considered templates and are removed from the list of "real"
 * declarations.
 * 2. We walk the remaining "real" declarations and resolve any type references,
 * if a reference refers to a template we first validate and resolve its type
 * arguments and then use those as inputs to materialize a new type to match
 * those type arguments.
 *
 * ## Two Types of Recursion
 *
 * 1. Type arguments may themselves be parameterized, and so we must
 * process generic type references recursively in a depth-first manner.
 *
 * 2. When materializing templates we may encounter more parameterized
 * references to other templates. In this way, template materialization can be
 * recursive, and we must take care to avoid infinite loops. We must also take
 * care to correctly track our scope such that type references in templates
 * which refer to generic types resolve to the correct type.
 */
class TemplateExtractor {
  _templates: Map<ts.Node, Template> = new Map();
  _definitions: Array<DefinitionNode> = [];
  _definedTemplates: Set<string> = new Set();
  _errors: ts.DiagnosticWithLocation[] = [];
  constructor(private ctx: TypeContext) {}

  materializeGenericTypeReferences(
    definitions: Array<DefinitionNode>,
  ): DiagnosticsResult<Array<DefinitionNode>> {
    // We filter out all template declarations and index them as a first pass.
    const filtered = definitions.filter((definition) => {
      return !this.maybeExtractAsTemplate(definition);
    });

    // Now we can visit the remaining "real" definitions and materialize any
    // generic type references.
    filtered.forEach((definition) => {
      this._definitions.push(this.materializeTemplatesForNode(definition));
    });

    if (this._errors.length > 0) {
      return err(this._errors);
    }
    return ok(this._definitions);
  }

  /**
   * Walks GraphQL ASTs and expands generic types into their concrete types
   * adding their materialized definitions to the `_definitions` array as we go.
   *
   * **Note:** Here we also detect generics being used as members of a union and
   * report that as an error.
   */
  materializeTemplatesForNode<N extends ASTNode>(node: N): N {
    return visit(node, {
      [Kind.NAME]: (node): NameNode => {
        const referenceNode = this.getReferenceNode(node);
        if (referenceNode == null) return node;
        const name = this.resolveTypeReferenceOrReport(referenceNode);
        if (name == null) return node;
        return { ...node, value: name };
      },
    });
  }

  resolveTypeReferenceOrReport(
    node: EntityNameWithTypeArguments,
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
            arg,
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
    referenceLoc: TsLocatableNode,
    typeParams: string[],
    template: Template,
  ): string {
    const paramsPrefix = typeParams.join("");
    const derivedName = paramsPrefix + template.declarationTemplate.name.value;
    if (this._definedTemplates.has(derivedName)) {
      // We've either already materialized this permutation or we're in the middle
      // of doing so.
      return derivedName;
    }
    this._definedTemplates.add(derivedName);

    const genericsContext = new Map<ts.Node, string>();
    for (const i of new Set(template.genericNodes.values())) {
      const name = nullThrows(typeParams[i]);
      const param = nullThrows(template.typeParameters[i]);
      genericsContext.set(param, name);
    }

    const gqlLoc = loc(referenceLoc);
    const original = template.declarationTemplate;
    const renamedDefinition = renameDefinition(original, derivedName, gqlLoc);

    const definition = visit(renamedDefinition, {
      [Kind.NAMED_TYPE]: (node): NamedTypeNode => {
        const referenceNode = this.getReferenceNode(node.name);
        if (referenceNode == null) return node;

        const name = this.resolveTypeReferenceOrReport(
          referenceNode,
          genericsContext,
        );

        if (name == null) return node;

        return { ...node, name: { ...node.name, value: name } };
      },
    });

    this._definitions.push(definition);
    return derivedName;
  }

  maybeExtractAsTemplate(definition: DefinitionNode): boolean {
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
    if (definition.kind === Kind.OBJECT_TYPE_DEFINITION) {
      if (definition.interfaces && definition.interfaces.length > 0) {
        const item = definition.interfaces[0].name;
        this._errors.push(gqlErr(item, E.genericTypeImplementsInterface()));
      }
    }
    this._templates.set(declaration, {
      declarationTemplate: definition,
      genericNodes,
      typeParameters: typeParams,
    });
    return true;
  }

  // --- Helpers ---

  getReferenceNode(name: NameNode): EntityNameWithTypeArguments | null {
    const node = this.ctx.getEntityName(name);
    if (node == null) {
      return null;
    }
    if (ts.isTypeReferenceNode(node.parent)) return node.parent;
    // Heritage clauses are not actually type references since they have
    // runtime semantics. Instead they are an "ExpressionWithTypeArguments"
    if (
      ts.isExpressionWithTypeArguments(node.parent) &&
      ts.isIdentifier(node.parent.expression)
    ) {
      return new EntityNameWithTypeArguments(
        node.parent.expression,
        node.parent.typeArguments,
      );
    }
    return null;
  }

  asNullable<T>(result: DiagnosticResult<T>): T | null {
    if (result.kind === "ERROR") {
      this._errors.push(result.err);
      return null;
    }
    return result.value;
  }

  report(
    node: TsLocatableNode,
    message: string,
    relatedInformation?: ts.DiagnosticRelatedInformation[],
  ): null {
    this._errors.push(tsErr(node, message, relatedInformation));
    return null;
  }
}

function mayReferenceGenerics(
  definition: DefinitionNode,
): definition is
  | ObjectTypeDefinitionNode
  | UnionTypeDefinitionNode
  | InputObjectTypeDefinitionNode
  | InterfaceTypeDefinitionNode {
  return (
    definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
    definition.kind === Kind.UNION_TYPE_DEFINITION ||
    definition.kind === Kind.INTERFACE_TYPE_DEFINITION ||
    (definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION &&
      !METADATA_INPUT_NAMES.has(definition.name.value))
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

/**
 * Abstraction that can be derived from a typeReference or an expression with
 * type arguments. Gives us a common shape which can model both a
 * `ts.TypeReferenceNode` and a `ts.ExpressionWithTypeArguments` while also
 * being able to use it to report diagnostics
 */
class EntityNameWithTypeArguments implements TsLocatableNode {
  constructor(
    public typeName: ts.EntityName,
    public typeArguments?: ts.NodeArray<ts.TypeNode>,
  ) {}

  getStart() {
    return this.typeName.getStart();
  }
  getEnd() {
    if (this.typeArguments == null || this.typeArguments.length === 0) {
      return this.typeName.getEnd();
    }
    return this.typeArguments[this.typeArguments.length - 1].getEnd();
  }
  getSourceFile() {
    return this.typeName.getSourceFile();
  }
}

// Given a type reference, recursively walk its type arguments and return all
// type references in the current scope.
function findAllReferences(
  node: EntityNameWithTypeArguments,
): EntityNameWithTypeArguments[] {
  const references: EntityNameWithTypeArguments[] = [];
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
function renameDefinition<T extends TypeDefinitionNode>(
  original: T,
  newName: string,
  loc: Location,
): T {
  const name = { ...original.name, value: newName, loc };
  return { ...original, loc, name, wasSynthesized: true };
}
