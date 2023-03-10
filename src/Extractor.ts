import {
  DefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  Kind,
  ListTypeNode,
  NamedTypeNode,
  Location as GraphQLLocation,
  NameNode,
  Source,
  Token,
  TokenKind,
  TypeNode,
  NonNullTypeNode,
  StringValueNode,
} from "graphql";
import { Position } from "./utils/Location";
import DiagnosticError, { AnnotatedLocation } from "./utils/DiagnosticError";
import * as ts from "typescript";

const LIBRARY_IMPORT_NAME = "<library import name>";
const LIBRARY_NAME = "<library name>";
const ISSUE_URL = "<issue URL>";

/**
 * Extracts GraphQL definitions from TypeScript source code.
 *
 * Note that we extract a GraphQL AST with the AST nodes' location information
 * populated with references to the TypeScript code from which the types were
 * derived.
 */
export class Extractor {
  definitions: DefinitionNode[] = [];
  sourceFile: ts.SourceFile;
  checker: ts.TypeChecker;

  constructor(sourceFile: ts.SourceFile, checker: ts.TypeChecker) {
    this.sourceFile = sourceFile;
    this.checker = checker;
  }

  extract(): DefinitionNode[] {
    ts.forEachChild(this.sourceFile, (node) => {
      if (ts.isClassDeclaration(node)) {
        this.classDeclaration(node);
      }
    });
    return this.definitions;
  }

  /** Error handling and location juggling */

  report(node: ts.Node, message: string) {
    // TODO: Ideally we could collect all errors and report them all at once
    throw new DiagnosticError(message, this.diagnosticAnnotatedLocation(node));
  }

  // Report an error that we don't know how to infer a type, but it's possible that we should.
  // Gives the user a path forward if they think we should be able to infer this type.
  reportUnhandled(node: ts.Node, message: string) {
    const suggestion = `If you think ${LIBRARY_NAME} should be able to infer this type, please report an issue at ${ISSUE_URL}.`;
    // TODO: Ideally we could collect all errors and report them all at once
    throw new DiagnosticError(
      `${message}\n\n${suggestion}`,
      this.diagnosticAnnotatedLocation(node),
    );
  }

  diagnosticAnnotatedLocation(node: ts.Node): AnnotatedLocation {
    const start = this.diagnosticPosition(node.getStart());
    const end = this.diagnosticPosition(node.getEnd());
    return new AnnotatedLocation({ start, end }, "");
  }

  diagnosticPosition(pos: number): Position {
    const { line, character } =
      this.sourceFile.getLineAndCharacterOfPosition(pos);
    return { offset: pos, line: line + 1, column: character + 1 };
  }

  // TODO: This is potentially quite expensive, and we only need it if we report
  // an error at one of these locations. We could consider some trick to return a
  // proxy object that would lazily compute the line/column info.
  loc(node: ts.Node): GraphQLLocation {
    const source = new Source(this.sourceFile.text, this.sourceFile.fileName);
    const startToken = this.gqlDummyToken(node.getStart());
    const endToken = this.gqlDummyToken(node.getEnd());
    const location = new GraphQLLocation(startToken, endToken, source);

    return location;
  }

  gqlDummyToken(pos: number): Token {
    const { line, character } =
      this.sourceFile.getLineAndCharacterOfPosition(pos);
    return new Token(TokenKind.SOF, pos, pos, line, character, null);
  }

  /** TypeScript traversals */

  collectFields(node: ts.ClassDeclaration): Array<FieldDefinitionNode> {
    const fields: FieldDefinitionNode[] = [];
    ts.forEachChild(node, (node) => {
      if (ts.isMethodDeclaration(node)) {
        const field = this.methodDeclaration(node);
        if (field) {
          fields.push(field);
        }
      } else if (ts.isPropertyDeclaration(node)) {
        const field = this.propertyDeclaration(node);
        if (field) {
          fields.push(field);
        }
      }
    });
    return fields;
  }

  collectArgs(
    node: ts.MethodDeclaration,
  ): ReadonlyArray<InputValueDefinitionNode> | null {
    const args: InputValueDefinitionNode[] = [];
    const argsParam = node.parameters[0];
    if (argsParam == null) {
      return null;
    }
    const argsType = argsParam.type;
    if (argsType == null) {
      this.report(
        argsParam,
        "Expected GraphQL field arguments to have a TypeScript type.",
      );
      return null;
    }
    if (!ts.isTypeLiteralNode(argsType)) {
      this.report(
        argsType,
        "Expected GraphQL field arguments to be typed using a literal object: `{someField: string}`.",
      );
      return null;
    }
    for (const member of argsType.members) {
      const arg = this.collectArg(member);
      if (arg != null) {
        args.push(arg);
      }
    }
    return args;
  }

  collectArg(node: ts.TypeElement): InputValueDefinitionNode | null {
    if (!ts.isPropertySignature(node)) {
      this.report(
        node,
        "Expected GraphQL field argument type to be a property signature.",
      );
      return null;
    }
    if (!ts.isIdentifier(node.name)) {
      this.report(
        node.name,
        "Expected GraphQL field argument names to be a literal.",
      );
      return null;
    }
    const type = this.collectInputType(node.type);
    if (type == null) return null;
    const description = this.collectDescription(node.name);
    return {
      kind: Kind.INPUT_VALUE_DEFINITION,
      loc: this.loc(node),
      description,
      name: this.gqlName(node.name, node.name.text),
      // FIXME: Correctly detect nullable types
      type: this.gqlNonNullType(node.type, type),
      // FIXME: Support default values
      defaultValue: null,
      directives: [],
    };
  }

  classDeclaration(node: ts.ClassDeclaration) {
    const tag = this.findTag(node, "GQLType");
    if (tag == null) return;

    const name = this.entityName(node, tag);
    if (name == null) return null;
    const description = this.collectDescription(node.name);

    const fields = this.collectFields(node);
    this.definitions.push({
      kind: Kind.OBJECT_TYPE_DEFINITION,
      loc: null,
      description,
      name,
      fields,
    });
  }

  entityName(
    node: ts.ClassDeclaration | ts.MethodDeclaration | ts.PropertyDeclaration,
    tag: ts.JSDocTag,
  ) {
    if (tag.comment != null) {
      console.log("tag.comment", tag.comment);
      return this.gqlName(tag, ts.getTextOfJSDocComment(tag.comment));
    }
    const id = this.expectIdentifier(node.name);
    if (id == null) return null;
    return this.gqlName(id, id.text);
  }

  methodDeclaration(node: ts.MethodDeclaration): FieldDefinitionNode | null {
    const tag = this.findTag(node, "GQLField");
    if (tag == null) return;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    const type = this.collectType(node.type);

    // We already reported an error
    if (type == null) return null;

    const args = this.collectArgs(node);

    const description = this.collectDescription(node.name);

    return {
      kind: Kind.FIELD_DEFINITION,
      loc: this.loc(node),
      description,
      name,
      arguments: args,
      type,
    };
  }

  collectDescription(node: ts.Node): StringValueNode | null {
    const symbol = this.checker.getSymbolAtLocation(node);
    const doc = symbol.getDocumentationComment(this.checker);
    const description = ts.displayPartsToString(doc);
    if (description) {
      return { kind: Kind.STRING, loc: this.loc(node), value: description };
    }
    return null;
  }

  propertyDeclaration(
    node: ts.PropertyDeclaration,
  ): FieldDefinitionNode | null {
    const tag = this.findTag(node, "GQLField");
    if (tag == null) return null;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    const type = this.collectType(node.type);

    // We already reported an error
    if (type == null) return null;
    const description = this.collectDescription(node.name);

    return {
      kind: Kind.FIELD_DEFINITION,
      loc: this.loc(node),
      description,
      name,
      arguments: null,
      type,
    };
  }

  collectInputType(node: ts.TypeNode): NamedTypeNode | ListTypeNode | null {
    if (ts.isTypeReferenceNode(node)) {
      // FIXME: Validate type reference
      return this.gqlNamedType(node, node.typeName.getText());
    } else if (ts.isArrayTypeNode(node)) {
      const element = this.collectInputType(node.elementType);
      return this.gqlListType(node, element);
    } else if (node.kind === ts.SyntaxKind.StringKeyword) {
      return this.gqlNamedType(node, "String");
    }
    this.reportUnhandled(node, `Unknown GraphQL type.`);
    return null;
  }

  collectType(node: ts.TypeNode): TypeNode | null {
    if (ts.isTypeReferenceNode(node)) {
      return this.typeReference(node);
    } else if (ts.isArrayTypeNode(node)) {
      const element = this.collectType(node.elementType);
      return this.gqlListType(node, element);
    } else if (ts.isUnionTypeNode(node)) {
      const types = node.types.filter((type) => !this.isNullish(type));
      if (types.length !== 1) {
        this.report(node, `Expected exactly one non-nullish type.`);
        return null;
      }
      return this.collectType(types[0]);
    } else if (node.kind === ts.SyntaxKind.StringKeyword) {
      return this.gqlNamedType(node, "String");
    } else if (node.kind === ts.SyntaxKind.NumberKeyword) {
      this.report(
        node,
        `Unexpected number type. GraphQL supports both Int and Float, making \`number\` ambiguous. Instead, import the \`Int\` or \`Float\` type from \`${LIBRARY_IMPORT_NAME}\` and use that.`,
      );
      return null;
    }
    this.reportUnhandled(node, `Unknown GraphQL type.`);
    return null;
  }

  typeReference(node: ts.TypeReferenceNode): TypeNode | null {
    const identifier = this.expectIdentifier(node.typeName);
    if (identifier == null) return null;

    const typeName = identifier.text;
    switch (typeName) {
      case "Promise":
        return this.collectType(node.typeArguments[0]);
      case "Array":
      case "Iterator":
      case "ReadonlyArray":
        const element = this.collectType(node.typeArguments[0]);
        return this.gqlListType(node, element);
      default:
        if (node.typeArguments && node.typeArguments.length > 0) {
          this.report(node.typeArguments[0], `Unexpected type argument.`);
        }
        // FIXME: Validate type reference
        return this.gqlNamedType(node, identifier.text);
    }
  }

  isNullish(node: ts.TypeNode): boolean {
    if (ts.isLiteralTypeNode(node)) {
      return node.literal.kind === ts.SyntaxKind.NullKeyword;
    }
    return (
      node.kind === ts.SyntaxKind.NullKeyword ||
      node.kind === ts.SyntaxKind.UndefinedKeyword ||
      node.kind === ts.SyntaxKind.VoidKeyword
    );
  }

  expectIdentifier(node: ts.Node): ts.Identifier | null {
    if (ts.isIdentifier(node)) {
      return node;
    }
    this.report(node, "Expected an identifier.");
    return null;
  }

  findTag(node: ts.Node, tagName: string): ts.JSDocTag | null {
    return (
      ts
        .getJSDocTags(node)
        .find((tag) => tag.tagName.escapedText === tagName) ?? null
    );
  }

  /** GraphQL AST node helper methods */

  gqlName(node: ts.Node, value: string): NameNode {
    return { kind: Kind.NAME, loc: this.loc(node), value };
  }
  gqlNamedType(node: ts.Node, value: string): NamedTypeNode {
    return {
      kind: Kind.NAMED_TYPE,
      loc: this.loc(node),
      name: this.gqlName(node, value),
    };
  }
  gqlNonNullType(
    node: ts.Node,
    type: NamedTypeNode | ListTypeNode,
  ): NonNullTypeNode {
    return { kind: Kind.NON_NULL_TYPE, loc: this.loc(node), type };
  }
  gqlListType(node: ts.Node, type: TypeNode): ListTypeNode {
    return { kind: Kind.LIST_TYPE, loc: this.loc(node), type };
  }
}
