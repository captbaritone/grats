import {
  InputObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
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
  tsRelated,
} from "./utils/DiagnosticError";
import { err, ok } from "./utils/Result";
import * as E from "./Errors";
import { ExtractionSnapshot } from "./Extractor";
import { ResolverArgument } from "./resolverSignature";

export const UNRESOLVED_REFERENCE_NAME = `__UNRESOLVED_REFERENCE__`;

export type DerivedResolverDefinition = {
  name: NameNode;
  path: string;
  exportName: string | null;
  args: ResolverArgument[];
  kind: "DERIVED_CONTEXT";
};

export type NameDefinition =
  | {
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
    }
  | DerivedResolverDefinition;

type TsIdentifier = number;

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
export class TypeContext {
  checker: ts.TypeChecker;

  _declarationToName: Map<ts.Declaration, NameDefinition> = new Map();
  _unresolvedNodes: Map<TsIdentifier, ts.EntityName> = new Map();
  _idToDeclaration: Map<TsIdentifier, ts.Declaration> = new Map();

  static fromSnapshot(
    checker: ts.TypeChecker,
    snapshot: ExtractionSnapshot,
  ): DiagnosticsResult<TypeContext> {
    const errors: FixableDiagnosticWithLocation[] = [];
    const self = new TypeContext(checker);
    for (const [node, typeName] of snapshot.unresolvedNames) {
      self._markUnresolvedType(node, typeName);
    }
    for (const [node, definition] of snapshot.nameDefinitions) {
      self._recordTypeName(node, definition);
    }
    for (const [definition, reference] of snapshot.implicitNameDefinitions) {
      const declaration = self.maybeTsDeclarationForTsName(reference.typeName);
      if (declaration == null) {
        errors.push(tsErr(reference.typeName, E.unresolvedTypeReference()));
        continue;
      }
      const existing = self._declarationToName.get(declaration);
      if (existing != null) {
        errors.push(
          // TODO: Better error messages here
          tsErr(declaration, "Duplicate derived contexts for given type", [
            tsRelated(reference, "One was defined here"),
            gqlRelated(existing.name, "Other here"),
          ]),
        );
        continue;
      }

      self._recordTypeName(declaration, definition);
    }

    if (errors.length > 0) {
      return err(errors);
    }
    return ok(self);
  }

  constructor(checker: ts.TypeChecker) {
    this.checker = checker;
  }

  // Record that a GraphQL construct of type `kind` with the name `name` is
  // declared at `node`.
  private _recordTypeName(node: ts.Declaration, definition: NameDefinition) {
    this._idToDeclaration.set(definition.name.tsIdentifier, node);
    this._declarationToName.set(node, definition);
  }

  // Record that a type references `node`
  private _markUnresolvedType(node: ts.EntityName, name: NameNode) {
    this._unresolvedNodes.set(name.tsIdentifier, node);
  }

  allNameDefinitions(): Iterable<NameDefinition> {
    return this._declarationToName.values();
  }

  findSymbolDeclaration(startSymbol: ts.Symbol): ts.Declaration | null {
    const symbol = this.resolveSymbol(startSymbol);
    const declaration = symbol.declarations?.[0];
    return declaration ?? null;
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

    const declarationResult = this.tsDeclarationForTsName(typeReference);
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

    const nameDefinition = this._declarationToName.get(declarationResult.value);
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
    const declaration = this.maybeTsDeclarationForTsName(referenceNode);
    if (declaration == null) return false;
    return this._declarationToName.has(declaration);
  }

  gqlNameDefinitionForGqlName(
    nameNode: NameNode,
  ): DiagnosticResult<NameDefinition> {
    const referenceNode = this.getEntityName(nameNode);
    if (referenceNode == null) {
      throw new Error("Expected to find reference node for name node.");
    }

    const declaration = this.maybeTsDeclarationForTsName(referenceNode);
    if (declaration == null) {
      return err(gqlErr(nameNode, E.unresolvedTypeReference()));
    }
    const definition = this._declarationToName.get(declaration);
    if (definition == null) {
      return err(gqlErr(nameNode, E.unresolvedTypeReference()));
    }
    return ok(definition);
  }

  // Note! This assumes you have already handled any type parameters.
  gqlNameForTsName(node: ts.EntityName): DiagnosticResult<string> {
    const declarationResult = this.tsDeclarationForTsName(node);
    if (declarationResult.kind === "ERROR") {
      return err(declarationResult.err);
    }
    if (ts.isTypeParameterDeclaration(declarationResult.value)) {
      return err(
        tsErr(node, "Type parameter not valid", [
          tsErr(declarationResult.value, "Defined here"),
        ]),
      );
    }

    const nameDefinition = this._declarationToName.get(declarationResult.value);
    if (nameDefinition == null) {
      return err(tsErr(node, E.unresolvedTypeReference()));
    }
    if (nameDefinition.kind === "CONTEXT" || nameDefinition.kind === "INFO") {
      return err(
        tsErr(node, E.contextOrInfoUsedInGraphQLPosition(nameDefinition.kind), [
          gqlRelated(nameDefinition.name, "Defined here"),
        ]),
      );
    }
    return ok(nameDefinition.name.value);
  }

  private maybeTsDeclarationForTsName(
    node: ts.EntityName,
  ): ts.Declaration | null {
    const symbol = this.checker.getSymbolAtLocation(node);
    if (symbol == null) {
      return null;
    }
    return this.findSymbolDeclaration(symbol);
  }

  tsDeclarationForTsName(
    node: ts.EntityName,
  ): DiagnosticResult<ts.Declaration> {
    const declaration = this.maybeTsDeclarationForTsName(node);
    if (!declaration) {
      return err(tsErr(node, E.unresolvedTypeReference()));
    }
    return ok(declaration);
  }

  tsDeclarationForGqlDefinition(
    definition:
      | ObjectTypeDefinitionNode
      | UnionTypeDefinitionNode
      | InputObjectTypeDefinitionNode
      | InterfaceTypeDefinitionNode,
  ): ts.Declaration {
    const name = definition.name;
    const declaration = this._idToDeclaration.get(name.tsIdentifier);
    if (!declaration) {
      console.log(definition);
      throw new Error(`Could not find declaration for ${name.value}`);
    }
    return declaration;
  }

  getEntityName(name: NameNode): ts.EntityName | null {
    const entityName = this._unresolvedNodes.get(name.tsIdentifier) ?? null;
    if (entityName == null && name.value === UNRESOLVED_REFERENCE_NAME) {
      throw new Error("Expected unresolved reference to have a node.");
    }
    return entityName;
  }
}
