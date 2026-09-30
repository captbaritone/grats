import { Location, NameNode } from "graphql";
import {
  gqlErr,
  DiagnosticResult,
  gqlRelated,
  DiagnosticsResult,
  FixableDiagnosticWithLocation,
} from "./utils/DiagnosticError.js";
import { err, ok } from "./utils/Result.js";
import * as E from "./Errors.js";
import { ExtractionSnapshot } from "./Extractor.js";
import { ResolverArgument } from "./resolverSignature.js";
import { DeclLoc, DeclRef, EntityNameRef } from "./snapshotRefs.js";
import { NameResolver, ResolvedDeclaration } from "./NameResolver.js";
import type { RustTypeContextState } from "./rs/codec.js";

export const UNRESOLVED_REFERENCE_NAME = `__UNRESOLVED_REFERENCE__`;

export type DerivedResolverDefinition = {
  name: NameNode;
  path: string;
  exportName: string | null;
  args: ResolverArgument[];
  kind: "DERIVED_CONTEXT";
  async: boolean;
};

export type NameDefinition = {
  name: NameNode;
  kind:
    | "TYPE"
    | "INTERFACE"
    | "UNION"
    | "SCALAR"
    | "INPUT_OBJECT"
    | "ENUM"
    | "CONTEXT"
    | "INFO";
};

export type DeclarationDefinition = NameDefinition | DerivedResolverDefinition;

import type { TsIdentifier } from "./utils/helpers.js";

/**
 * Public interface for TypeContext.
 *
 * Used to track TypeScript references and resolve type names between
 * TypeScript and GraphQL.
 */
export interface ITypeContext {
  /** Checks if an unresolved NameNode refers to a GraphQL type */
  unresolvedNameIsGraphQL(unresolved: NameNode): boolean;

  /** Gets the declaration definition for a GraphQL NameNode */
  gqlNameDefinitionForGqlName(
    nameNode: NameNode,
  ): DiagnosticResult<DeclarationDefinition>;
}

/**
 * Used to track TypeScript references.
 *
 * If a TS method is typed as returning `MyType`, we need to look at that type's
 * GQLType annotation to find out its name. However, we may not have seen that
 * class yet.
 *
 * So, we employ a two pass approach. When we encounter a reference to a type
 * we model it as a dummy type reference in the GraphQL AST. Then, after we've
 * parsed all the files, we traverse the GraphQL schema, resolving all the dummy
 * type references.
 */
export class TypeContext implements ITypeContext {
  private resolver: NameResolver;

  private _declarationToDefinition: Map<DeclLoc, DeclarationDefinition> =
    new Map();
  private _unresolvedNodes: Map<TsIdentifier, EntityNameRef> = new Map();
  private _idToDeclaration: Map<TsIdentifier, DeclRef> = new Map();

  static fromSnapshot(
    resolver: NameResolver,
    snapshot: ExtractionSnapshot,
  ): DiagnosticsResult<TypeContext> {
    const errors: FixableDiagnosticWithLocation[] = [];
    const self = new TypeContext(resolver);
    self._unresolvedNodes = snapshot.unresolvedNames;
    for (const {
      declaration,
      definition,
    } of snapshot.nameDefinitions.values()) {
      self._idToDeclaration.set(definition.name.tsIdentifier, declaration);
      self._declarationToDefinition.set(declaration.declLoc, definition);
    }
    for (const [definition, reference] of snapshot.implicitNameDefinitions) {
      const declaration = self.maybeDeclarationForTsName(reference.name);
      if (declaration == null) {
        errors.push(
          gqlErr({ loc: reference.name }, E.unresolvedTypeReference()),
        );
        continue;
      }
      const existing = self._declarationToDefinition.get(declaration.declLoc);
      if (existing != null) {
        errors.push(
          gqlErr(
            declaration,
            "Multiple derived contexts defined for given type",
            [
              gqlRelated(definition.name, "One was defined here"),
              gqlRelated(existing.name, "Another here"),
            ],
          ),
        );
        continue;
      }
      self._declarationToDefinition.set(declaration.declLoc, definition);
    }

    if (errors.length > 0) {
      return err(errors);
    }
    return ok(self);
  }

  constructor(resolver: NameResolver) {
    this.resolver = resolver;
  }

  private findDeclaration(
    declarations: ResolvedDeclaration[],
  ): ResolvedDeclaration | null {
    if (declarations.length === 0) {
      return null;
    }
    // When a symbol has multiple declarations (e.g., `const X` and `type X`
    // sharing a name), prefer the one registered in the GraphQL schema.
    if (declarations.length > 1) {
      for (const decl of declarations) {
        if (this._declarationToDefinition.has(decl.declLoc)) {
          return decl;
        }
      }
    }
    return declarations[0];
  }

  unresolvedNameIsGraphQL(unresolved: NameNode): boolean {
    const referenceNode = this.getEntityName(unresolved);
    if (referenceNode == null) return false;
    const declaration = this.maybeDeclarationForTsName(referenceNode.name);
    if (declaration == null) return false;
    return this._declarationToDefinition.has(declaration.declLoc);
  }

  gqlNameDefinitionForGqlName(
    nameNode: NameNode,
  ): DiagnosticResult<DeclarationDefinition> {
    const referenceNode = this.getEntityName(nameNode);
    if (referenceNode == null) {
      throw new Error("Expected to find reference node for name node.");
    }

    const declaration = this.maybeDeclarationForTsName(referenceNode.name);
    if (declaration == null) {
      return err(gqlErr(nameNode, E.unresolvedTypeReference()));
    }
    const definition = this._declarationToDefinition.get(declaration.declLoc);
    if (definition == null) {
      return err(gqlErr(nameNode, E.unresolvedTypeReference()));
    }
    return ok(definition);
  }

  private maybeDeclarationForTsName(
    name: Location,
  ): ResolvedDeclaration | null {
    return this.findDeclaration(this.resolver.resolveEntityName(name));
  }

  /**
   * The state the Rust port of `TypeContext` is built from, until
   * `fromSnapshot` is ported. See `TypeContextState` in
   * `grats-rs/crates/grats/src/type_context.rs`.
   *
   * The checker only exists on the TypeScript side, so it resolves each entity
   * name the Rust `TypeContext` may be asked about ahead of time.
   */
  rustState(): RustTypeContextState {
    return {
      declarationToDefinition: Array.from(this._declarationToDefinition),
      unresolvedNodes: Array.from(this._unresolvedNodes),
      idToDeclaration: Array.from(this._idToDeclaration),
      resolvedEntityNames: this.resolveEntityNamesForRust(),
    };
  }

  // Resolves each entity name in `_unresolvedNodes`, and those in their type
  // arguments.
  private resolveEntityNamesForRust(): RustTypeContextState["resolvedEntityNames"] {
    const resolved: RustTypeContextState["resolvedEntityNames"] = [];
    const resolve = (ref: EntityNameRef) => {
      const declarations = this.resolver
        .resolveEntityName(ref.name)
        .map(({ kind, declLoc, loc }) => ({
          kind,
          declLoc,
          // Only read for type parameters, and computed lazily.
          loc: kind === "TYPE_PARAMETER" ? loc : null,
        }));
      resolved.push([ref.name, declarations]);
      for (const arg of ref.typeArguments ?? []) {
        if (arg.kind === "ENTITY_NAME") {
          resolve(arg);
        }
      }
    };
    for (const ref of this._unresolvedNodes.values()) {
      resolve(ref);
    }
    return resolved;
  }

  getEntityName(name: NameNode): EntityNameRef | null {
    const entityName = this._unresolvedNodes.get(name.tsIdentifier) ?? null;
    if (entityName == null && name.value === UNRESOLVED_REFERENCE_NAME) {
      throw new Error("Expected unresolved reference to have a node.");
    }
    return entityName;
  }
}
