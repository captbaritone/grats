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
import { TypeContext } from "../TypeContext.js";
import * as ts from "typescript";
import { err, ok } from "../utils/Result.js";
import {
  DiagnosticResult,
  DiagnosticsResult,
  gqlErr,
} from "../utils/DiagnosticError.js";
import { extend, invariant, nullThrows } from "../utils/helpers.js";
import * as E from "../Errors.js";
import { DeclLoc, EntityNameRef, TypeParameterRef } from "../snapshotRefs.js";

type Template = {
  declarationTemplate: TypeDefinitionNode;
  typeParameters: TypeParameterRef[];
  // References to the template's type parameters in GraphQL positions, keyed
  // by `locKey`.
  genericNodes: Map<string, GenericReference>;
};

type GenericReference = {
  name: Location;
  // Index of the referenced type parameter
  index: number;
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
  _templates: Map<DeclLoc, Template> = new Map();
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
   * Given a concrete (non-Generic) GraphQL type, walks GraphQL ASTs and expands
   * generic types into their concrete types adding their materialized
   * definitions to the `_definitions` array as we go.
   *
   * **Note:** Here we also detect generics being used as members of a union and
   * report that as an error.
   */
  materializeTemplatesForNode<N extends ASTNode>(node: N): N {
    return visit(node, {
      [Kind.NAME]: (node): NameNode | undefined => {
        const referenceNode = this.getReferenceNode(node);
        if (referenceNode == null) return undefined;
        const name = this.resolveTypeReferenceOrReport(referenceNode);
        if (name == null) return undefined;
        return { ...node, value: name };
      },
    });
  }

  resolveTypeReferenceOrReport(
    node: EntityNameRef,
    generics?: Map<DeclLoc, string>,
  ): string | null {
    const declaration = this.asNullable(this.ctx.resolveEntityName(node.name));
    if (declaration == null) return null;

    if (generics != null) {
      // Maybe this node references a generic!
      const genericName = generics.get(declaration.declLoc);
      if (genericName != null) {
        return genericName;
      }
    }

    const template = this._templates.get(declaration.declLoc);
    if (template != null) {
      const templateName = template.declarationTemplate.name.value;
      const typeArguments = node.typeArguments ?? [];

      const genericIndexes = new Map<number, Location>();
      for (const { name, index } of template.genericNodes.values()) {
        genericIndexes.set(index, name);
      }

      const names: Array<string | null> = [];
      for (let i = 0; i < template.typeParameters.length; i++) {
        const exampleGenericNode = genericIndexes.get(i);
        if (exampleGenericNode == null) {
          // This type param in the template is not used in a GraphQL position.
          // We won't include it in the derived name.
          names.push(null);
          continue;
        }
        const param = template.typeParameters[i];
        const paramName = param.name;
        const arg = typeArguments[i];
        if (arg == null) {
          return this.report(
            node.loc,
            E.missingGenericType(templateName, paramName),
            [
              gqlErr(param, `Type parameter \`${paramName}\` is defined here`),
              gqlErr(
                { loc: exampleGenericNode },
                `and expects a GraphQL type because it was used in a GraphQL position here.`,
              ),
            ],
          );
        }
        if (arg.kind !== "ENTITY_NAME") {
          return this.report(
            arg.loc,
            E.nonGraphQLGenericType(templateName, paramName),
            [
              gqlErr(param, `Type parameter \`${paramName}\` is defined here`),
              gqlErr(
                { loc: exampleGenericNode },
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

      return this.materializeTemplate(node.loc, names, template);
    }
    const nameResult = this.ctx.gqlNameForTsName(node.name);

    return this.asNullable(nameResult);
  }

  templateName(typeParams: Array<string | null>, template: Template): string {
    const givenName = template.declarationTemplate.name.value;

    // TODO: If we want to support templated names, e.g. `<T><K>Foo` we would do
    // that here.

    const paramsPrefix = typeParams.filter((name) => name != null).join("");
    return paramsPrefix + givenName;
  }

  materializeTemplate(
    referenceLoc: Location,
    typeParams: Array<string | null>,
    template: Template,
  ): string {
    const derivedName = this.templateName(typeParams, template);
    if (this._definedTemplates.has(derivedName)) {
      // We've either already materialized this permutation or we're in the middle
      // of doing so.
      return derivedName;
    }
    this._definedTemplates.add(derivedName);

    // Mapping from the template's type param declaration to the GraphQL name
    // passed in for this particular use.
    const genericsContext = new Map<DeclLoc, string>();
    const genericIndexes = Array.from(
      template.genericNodes.values(),
      (generic) => generic.index,
    );
    for (const i of new Set(genericIndexes)) {
      const name = typeParams[i];
      invariant(name !== undefined, "typeParams[i] should not be undefined");
      if (name == null) {
        // If this type was not used in a GraphQL position, we won't have a
        // corresponding type argument.
        continue;
      }
      const param = nullThrows(template.typeParameters[i]);
      genericsContext.set(param.declLoc, name);
    }

    const original = template.declarationTemplate;
    const renamedDefinition = renameDefinition(
      original,
      derivedName,
      referenceLoc,
    );

    const definition = visit(renamedDefinition, {
      [Kind.NAMED_TYPE]: (node): NamedTypeNode | undefined => {
        const referenceNode = this.getReferenceNode(node.name);
        if (referenceNode == null) return undefined;

        const name = this.resolveTypeReferenceOrReport(
          referenceNode,
          genericsContext,
        );

        if (name == null) return undefined;

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
    const declaration = this.ctx.declarationForGqlDefinition(definition);
    const typeParams = declaration.typeParameters;

    if (typeParams.length === 0) {
      return false;
    }

    const genericNodes = new Map<string, GenericReference>();

    visit(definition, {
      [Kind.NAMED_TYPE]: (node) => {
        const referenceNode = this.getReferenceNode(node.name);
        if (referenceNode == null) return;
        const references = findAllReferences(referenceNode);
        for (const reference of references) {
          const declarationResult = this.ctx.resolveEntityName(reference.name);
          if (declarationResult.kind === "ERROR") {
            this._errors.push(declarationResult.err);
            return;
          }
          const declaration = declarationResult.value;

          // If the type points to a type param...
          if (declaration.kind !== "TYPE_PARAMETER") {
            return;
          }
          // And it's one of our parent type's type params...
          const genericIndex = typeParams.findIndex(
            (param) => param.declLoc === declaration.declLoc,
          );
          if (genericIndex !== -1) {
            genericNodes.set(locKey(reference.name), {
              name: reference.name,
              index: genericIndex,
            });
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
    this._templates.set(declaration.declLoc, {
      declarationTemplate: definition,
      genericNodes,
      typeParameters: typeParams,
    });
    return true;
  }

  // --- Helpers ---

  /**
   * Given a name within a non-Generic GraphQL definition, finds the corresponding
   * TypeScript node representing the type reference.
   *
   * For example, in:
   *
   * ```ts
   * // gqlType
   * type User {
   *   // gqlField
   *   friend: Person
   * }
   * ```
   *
   * Given the `Person` NameNode, this will return the reference to the
   * `Person` TypeScript type recorded during extraction.
   */
  getReferenceNode(name: NameNode): EntityNameRef | null {
    return this.ctx.getEntityName(name);
  }

  asNullable<T>(result: DiagnosticResult<T>): T | null {
    if (result.kind === "ERROR") {
      this._errors.push(result.err);
      return null;
    }
    return result.value;
  }

  report(
    loc: Location,
    message: string,
    relatedInformation?: ts.DiagnosticRelatedInformation[],
  ): null {
    this._errors.push(gqlErr({ loc }, message, relatedInformation));
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
    definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
  );
}

// Identifies a location by its file and start offset. Unlike `Location`
// objects, which may be created more than once for the same node, keys for the
// same node are equal.
function locKey(loc: Location): string {
  return `${loc.source.name}:${loc.start}`;
}

// Given a type reference, recursively walk its type arguments and return all
// type references in the current scope.
function findAllReferences(node: EntityNameRef): EntityNameRef[] {
  const references: EntityNameRef[] = [];
  if (node.typeArguments != null) {
    for (const arg of node.typeArguments) {
      if (arg.kind === "ENTITY_NAME") {
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
