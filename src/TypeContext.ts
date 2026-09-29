import {
  InputObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  Location,
  NameNode,
  ObjectTypeDefinitionNode,
  UnionTypeDefinitionNode,
} from "graphql";
import * as ts from "typescript";
import {
  gqlErr,
  DiagnosticResult,
  tsErr,
  gqlRelated,
  DiagnosticsResult,
  FixableDiagnosticWithLocation,
} from "./utils/DiagnosticError.js";
import { err, ok } from "./utils/Result.js";
import * as E from "./Errors.js";
import { ExtractionSnapshot } from "./Extractor.js";
import { ResolverArgument } from "./resolverSignature.js";
import { DeclLoc, DeclRef, EntityNameRef, declLoc } from "./snapshotRefs.js";
import { NodeLocator } from "./utils/NodeLocator.js";

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
  /** Resolves an unresolved NameNode to its actual GraphQL name */
  resolveUnresolvedNamedType(unresolved: NameNode): DiagnosticResult<NameNode>;

  /** Checks if an unresolved NameNode refers to a GraphQL type */
  unresolvedNameIsGraphQL(unresolved: NameNode): boolean;

  /** Gets the declaration definition for a GraphQL NameNode */
  gqlNameDefinitionForGqlName(
    nameNode: NameNode,
  ): DiagnosticResult<DeclarationDefinition>;

  /** Gets the GraphQL name for a TypeScript entity name */
  gqlNameForTsName(name: Location): DiagnosticResult<string>;
}

/**
 * What a TypeScript entity name refers to: either a type parameter, or some
 * other declaration.
 */
export type ResolvedEntityName = {
  kind: "TYPE_PARAMETER" | "DECLARATION";
  declLoc: DeclLoc;
};

/**
 * Additional methods implemented by TypeContext for use during type resolution.
 */
export interface ITypeContextForResolveTypes extends ITypeContext {
  /**
   * Resolves a TypeScript entity name to the declaration it refers to.
   */
  resolveEntityName(name: Location): DiagnosticResult<ResolvedEntityName>;

  /**
   * Gets the TypeScript declaration for a GraphQL definition node
   * Currently used exclusively for taking a GraphQL declaration and
   * finding its TypeScript declaration in order to find generic type
   * parameters.
   */
  declarationForGqlDefinition(
    definition:
      | ObjectTypeDefinitionNode
      | UnionTypeDefinitionNode
      | InputObjectTypeDefinitionNode
      | InterfaceTypeDefinitionNode,
  ): DeclRef;

  /** Gets the TypeScript entity name associated with a GraphQL NameNode */
  getEntityName(name: NameNode): EntityNameRef | null;
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
export class TypeContext implements ITypeContext, ITypeContextForResolveTypes {
  private checker: ts.TypeChecker;
  private locator: NodeLocator;

  private _declarationToDefinition: Map<DeclLoc, DeclarationDefinition> =
    new Map();
  private _unresolvedNodes: Map<TsIdentifier, EntityNameRef> = new Map();
  private _idToDeclaration: Map<TsIdentifier, DeclRef> = new Map();

  static fromSnapshot(
    checker: ts.TypeChecker,
    locator: NodeLocator,
    snapshot: ExtractionSnapshot,
  ): DiagnosticsResult<TypeContext> {
    const errors: FixableDiagnosticWithLocation[] = [];
    const self = new TypeContext(checker, locator);
    self._unresolvedNodes = snapshot.unresolvedNames;
    for (const {
      declaration,
      definition,
    } of snapshot.nameDefinitions.values()) {
      self._idToDeclaration.set(definition.name.tsIdentifier, declaration);
      self._declarationToDefinition.set(declaration.declLoc, definition);
    }
    for (const [definition, reference] of snapshot.implicitNameDefinitions) {
      const declaration = self.maybeTsDeclarationForTsName(reference.name);
      if (declaration == null) {
        errors.push(
          gqlErr({ loc: reference.name }, E.unresolvedTypeReference()),
        );
        continue;
      }
      const existing = self._declarationToDefinition.get(declLoc(declaration));
      if (existing != null) {
        errors.push(
          tsErr(
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
      self._declarationToDefinition.set(declLoc(declaration), definition);
    }

    if (errors.length > 0) {
      return err(errors);
    }
    return ok(self);
  }

  constructor(checker: ts.TypeChecker, locator: NodeLocator) {
    this.checker = checker;
    this.locator = locator;
  }

  private findSymbolDeclaration(startSymbol: ts.Symbol): ts.Declaration | null {
    const symbol = this.resolveSymbol(startSymbol);
    const declarations = symbol.declarations;
    if (declarations == null || declarations.length === 0) {
      return null;
    }
    // When a symbol has multiple declarations (e.g., `const X` and `type X`
    // sharing a name), prefer the one registered in the GraphQL schema.
    if (declarations.length > 1) {
      for (const decl of declarations) {
        if (this._declarationToDefinition.has(declLoc(decl))) {
          return decl;
        }
      }
    }
    return declarations[0];
  }

  // Follow symbol aliases until we find the original symbol. Accounts for
  // cyclical aliases.
  private resolveSymbol(startSymbol: ts.Symbol): ts.Symbol {
    let symbol = startSymbol;
    const visitedSymbols = new Set<ts.Symbol>();

    while (ts.SymbolFlags.Alias & symbol.flags) {
      if (visitedSymbols.has(symbol)) {
        throw new Error("Cyclical alias detected. Breaking resolution.");
      }

      visitedSymbols.add(symbol);
      symbol = this.checker.getAliasedSymbol(symbol);
    }
    return symbol;
  }

  resolveUnresolvedNamedType(unresolved: NameNode): DiagnosticResult<NameNode> {
    if (unresolved.value !== UNRESOLVED_REFERENCE_NAME) {
      return ok(unresolved);
    }
    const typeReference = this.getEntityName(unresolved);
    if (typeReference == null) {
      throw new Error("Unexpected unresolved reference name.");
    }

    const declarationResult = this.tsDeclarationForTsName(typeReference.name);
    if (declarationResult.kind === "ERROR") {
      return err(declarationResult.err);
    }
    if (ts.isTypeParameterDeclaration(declarationResult.value)) {
      return err(
        gqlErr(
          unresolved,
          "Type parameters are not supported in this context.",
        ),
      );
    }

    const nameDefinition = this._declarationToDefinition.get(
      declLoc(declarationResult.value),
    );
    if (nameDefinition == null) {
      return err(gqlErr(unresolved, E.unresolvedTypeReference()));
    }
    if (nameDefinition.kind === "CONTEXT" || nameDefinition.kind === "INFO") {
      return err(
        gqlErr(
          unresolved,
          E.contextOrInfoUsedInGraphQLPosition(nameDefinition.kind),
          [gqlRelated(nameDefinition.name, "Defined here")],
        ),
      );
    }
    return ok({ ...unresolved, value: nameDefinition.name.value });
  }

  unresolvedNameIsGraphQL(unresolved: NameNode): boolean {
    const referenceNode = this.getEntityName(unresolved);
    if (referenceNode == null) return false;
    const declaration = this.maybeTsDeclarationForTsName(referenceNode.name);
    if (declaration == null) return false;
    return this._declarationToDefinition.has(declLoc(declaration));
  }

  gqlNameDefinitionForGqlName(
    nameNode: NameNode,
  ): DiagnosticResult<DeclarationDefinition> {
    const referenceNode = this.getEntityName(nameNode);
    if (referenceNode == null) {
      throw new Error("Expected to find reference node for name node.");
    }

    const declaration = this.maybeTsDeclarationForTsName(referenceNode.name);
    if (declaration == null) {
      return err(gqlErr(nameNode, E.unresolvedTypeReference()));
    }
    const definition = this._declarationToDefinition.get(declLoc(declaration));
    if (definition == null) {
      return err(gqlErr(nameNode, E.unresolvedTypeReference()));
    }
    return ok(definition);
  }

  // Note! This assumes you have already handled any type parameters.
  gqlNameForTsName(name: Location): DiagnosticResult<string> {
    const declarationResult = this.tsDeclarationForTsName(name);
    if (declarationResult.kind === "ERROR") {
      return err(declarationResult.err);
    }
    if (ts.isTypeParameterDeclaration(declarationResult.value)) {
      return err(
        gqlErr({ loc: name }, "Type parameter not valid", [
          tsErr(declarationResult.value, "Defined here"),
        ]),
      );
    }

    const nameDefinition = this._declarationToDefinition.get(
      declLoc(declarationResult.value),
    );
    if (nameDefinition == null) {
      return err(gqlErr({ loc: name }, E.unresolvedTypeReference()));
    }
    if (nameDefinition.kind === "CONTEXT" || nameDefinition.kind === "INFO") {
      return err(
        gqlErr(
          { loc: name },
          E.contextOrInfoUsedInGraphQLPosition(nameDefinition.kind),
          [gqlRelated(nameDefinition.name, "Defined here")],
        ),
      );
    }
    return ok(nameDefinition.name.value);
  }

  private maybeTsDeclarationForTsName(name: Location): ts.Declaration | null {
    const symbol = this.checker.getSymbolAtLocation(this.locator.nodeAt(name));
    if (symbol == null) {
      return null;
    }
    return this.findSymbolDeclaration(symbol);
  }

  private tsDeclarationForTsName(
    name: Location,
  ): DiagnosticResult<ts.Declaration> {
    const declaration = this.maybeTsDeclarationForTsName(name);
    if (!declaration) {
      return err(gqlErr({ loc: name }, E.unresolvedTypeReference()));
    }
    return ok(declaration);
  }

  resolveEntityName(name: Location): DiagnosticResult<ResolvedEntityName> {
    const declarationResult = this.tsDeclarationForTsName(name);
    if (declarationResult.kind === "ERROR") {
      return err(declarationResult.err);
    }
    const declaration = declarationResult.value;
    return ok({
      kind: ts.isTypeParameterDeclaration(declaration)
        ? "TYPE_PARAMETER"
        : "DECLARATION",
      declLoc: declLoc(declaration),
    });
  }

  declarationForGqlDefinition(
    definition:
      | ObjectTypeDefinitionNode
      | UnionTypeDefinitionNode
      | InputObjectTypeDefinitionNode
      | InterfaceTypeDefinitionNode,
  ): DeclRef {
    const name = definition.name;
    const declaration = this._idToDeclaration.get(name.tsIdentifier);
    if (!declaration) {
      console.log(definition);
      throw new Error(`Could not find declaration for ${name.value}`);
    }
    return declaration;
  }

  getEntityName(name: NameNode): EntityNameRef | null {
    const entityName = this._unresolvedNodes.get(name.tsIdentifier) ?? null;
    if (entityName == null && name.value === UNRESOLVED_REFERENCE_NAME) {
      throw new Error("Expected unresolved reference to have a node.");
    }
    return entityName;
  }
}
