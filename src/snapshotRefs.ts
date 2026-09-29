import { Location } from "graphql";
import * as ts from "typescript";
import { loc } from "./GraphQLConstructor.js";

/**
 * Plain-data handles which the extractor records in an `ExtractionSnapshot`
 * in place of TypeScript AST nodes. They capture everything later passes need
 * to know about a node syntactically. Anything that requires knowing what a
 * name refers to is answered by `TypeContext`.
 */

/**
 * Identifies a TypeScript declaration by the file and position at which it is
 * declared. Two `DeclLoc`s are equal if and only if they identify the same
 * declaration.
 */
export type DeclLoc = string & { readonly __brand: "DeclLoc" };

/**
 * A declaration which defines a GraphQL construct, or a TypeScript interface
 * used to define one.
 */
export type DeclRef = {
  declLoc: DeclLoc;
  /** The declaration's name, or the whole declaration if it's anonymous. */
  name: Location;
  /** Used to materialize generic types. */
  typeParameters: TypeParameterRef[];
};

export type TypeParameterRef = {
  declLoc: DeclLoc;
  name: string;
  /** The whole type parameter declaration, including any constraint. */
  loc: Location;
};

/**
 * A reference to a TypeScript type by name, such as `Foo`, `ns.Foo` or
 * `Foo<Bar>`, which may reference a GraphQL type.
 */
export type EntityNameRef = {
  kind: "ENTITY_NAME";
  /** The name being referenced, e.g. `ns.Foo` in `ns.Foo<Bar>`. */
  name: Location;
  /** The whole reference, including any type arguments. */
  loc: Location;
  typeArguments: TypeArgumentRef[] | null;
};

export type TypeArgumentRef =
  | EntityNameRef
  | { kind: "OTHER_TYPE"; loc: Location };

export function declLoc(node: ts.Declaration): DeclLoc {
  // Anchor on the name, if there is one, since its position is unaffected
  // by any modifiers or decorators.
  const anchor = ts.getNameOfDeclaration(node) ?? node;
  return `${anchor.getSourceFile().fileName}:${anchor.getStart()}` as DeclLoc;
}

export function declRef(node: ts.DeclarationStatement): DeclRef {
  return {
    declLoc: declLoc(node),
    name: loc(ts.getNameOfDeclaration(node) ?? node),
    typeParameters: getTypeParameters(node).map((param) => ({
      declLoc: declLoc(param),
      name: param.name.text,
      loc: loc(param),
    })),
  };
}

function getTypeParameters(
  declaration: ts.Declaration,
): readonly ts.TypeParameterDeclaration[] {
  if (ts.isTypeAliasDeclaration(declaration)) {
    return declaration.typeParameters ?? [];
  }
  if (ts.isInterfaceDeclaration(declaration)) {
    return declaration.typeParameters ?? [];
  }
  if (ts.isClassDeclaration(declaration)) {
    return declaration.typeParameters ?? [];
  }
  // TODO: Handle other types of declarations which have generics.
  return [];
}

/**
 * Given the entity name of a type reference or heritage clause, records the
 * reference along with its type arguments.
 */
export function entityNameRef(node: ts.EntityName): EntityNameRef {
  if (ts.isTypeReferenceNode(node.parent)) {
    return typeReferenceRef(node.parent);
  }
  // Heritage clauses are not actually type references since they have
  // runtime semantics. Instead they are an "ExpressionWithTypeArguments"
  if (
    ts.isExpressionWithTypeArguments(node.parent) &&
    ts.isIdentifier(node.parent.expression)
  ) {
    const { expression, typeArguments } = node.parent;
    // The reference spans from the name to the end of its last type
    // argument, excluding the closing `>`.
    const last = typeArguments?.[typeArguments.length - 1] ?? expression;
    return {
      kind: "ENTITY_NAME",
      name: loc(expression),
      loc: loc({
        getStart: () => expression.getStart(),
        getEnd: () => last.getEnd(),
        getSourceFile: () => expression.getSourceFile(),
      }),
      typeArguments: typeArgumentRefs(typeArguments),
    };
  }
  throw new Error(
    "Expected entity name to be part of a type reference or heritage clause.",
  );
}

function typeReferenceRef(node: ts.TypeReferenceNode): EntityNameRef {
  return {
    kind: "ENTITY_NAME",
    name: loc(node.typeName),
    loc: loc(node),
    typeArguments: typeArgumentRefs(node.typeArguments),
  };
}

function typeArgumentRefs(
  typeArguments: ts.NodeArray<ts.TypeNode> | undefined,
): TypeArgumentRef[] | null {
  if (typeArguments == null) {
    return null;
  }
  return typeArguments.map((arg) => {
    if (ts.isTypeReferenceNode(arg)) {
      return typeReferenceRef(arg);
    }
    return { kind: "OTHER_TYPE", loc: loc(arg) };
  });
}
