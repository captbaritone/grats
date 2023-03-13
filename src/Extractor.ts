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
  ConstValueNode,
  ConstDirectiveNode,
  ConstArgumentNode,
} from "graphql";
import { Position } from "./utils/Location";
import DiagnosticError, { AnnotatedLocation } from "./utils/DiagnosticError";
import * as ts from "typescript";
import { TypeContext, UNRESOLVED_REFERENCE_NAME } from "./TypeContext";

const LIBRARY_IMPORT_NAME = "<library import name>";
const LIBRARY_NAME = "<library name>";
const ISSUE_URL = "<issue URL>";

type ArgDefaults = Map<string, ts.Expression>;

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
  ctx: TypeContext;

  constructor(sourceFile: ts.SourceFile, ctx: TypeContext) {
    this.sourceFile = sourceFile;
    this.ctx = ctx;
  }

  extract(): DefinitionNode[] {
    ts.forEachChild(this.sourceFile, (node) => {
      if (ts.isClassDeclaration(node)) {
        this.classDeclaration(node);
      } else if (ts.isInterfaceDeclaration(node)) {
        this.interfaceDeclaration(node);
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
    return new GraphQLLocation(startToken, endToken, source);
  }

  gqlDummyToken(pos: number): Token {
    const { line, character } =
      this.sourceFile.getLineAndCharacterOfPosition(pos);
    return new Token(TokenKind.SOF, pos, pos, line, character, undefined);
  }

  /** TypeScript traversals */

  classDeclaration(node: ts.ClassDeclaration) {
    const tag = this.findTag(node, "GQLType");
    if (tag == null) return;

    const name = this.entityName(node, tag);
    if (name == null || node.name == null) return null;

    const description = this.collectDescription(node.name);

    const fields = this.collectFields(node);

    const interfaces = this.collectInterfaces(node);

    this.ctx.recordTypeName(node.name, name.value);

    this.definitions.push({
      kind: Kind.OBJECT_TYPE_DEFINITION,
      loc: this.loc(node),
      description: description ?? undefined,
      name,
      fields,
      interfaces: interfaces ?? undefined,
    });
  }

  collectInterfaces(node: ts.ClassDeclaration): Array<NamedTypeNode> | null {
    if (node.heritageClauses == null) return null;

    const maybeInterfaces: Array<NamedTypeNode | null> =
      node.heritageClauses.flatMap((clause): Array<NamedTypeNode | null> => {
        if (clause.token !== ts.SyntaxKind.ImplementsKeyword) return [];
        return clause.types.map((type) => {
          if (!ts.isIdentifier(type.expression)) {
            // TODO: Are there valid cases we want to cover here?
            return null;
          }
          const namedType = this.gqlNamedType(
            type.expression,
            UNRESOLVED_REFERENCE_NAME,
          );
          this.ctx.markUnresolvedType(type.expression, namedType);
          return namedType;
        });
      });

    const interfaces = maybeInterfaces.filter(
      (i): i is NamedTypeNode => i != null,
    );

    if (interfaces.length === 0) {
      return null;
    }

    return interfaces;
  }

  interfaceDeclaration(node: ts.InterfaceDeclaration) {
    const tag = this.findTag(node, "GQLInterface");
    if (tag == null) return;

    const name = this.entityName(node, tag);
    if (name == null || name.value == null) {
      return;
    }
    const description = this.collectDescription(node.name);

    const fields = this.collectFields(node);

    this.ctx.recordTypeName(node.name, name.value);

    // While GraphQL supports interfaces taht extend other interfaces,
    // TypeScript does not. So we can't support that here either.

    this.definitions.push({
      kind: Kind.INTERFACE_TYPE_DEFINITION,
      loc: this.loc(node),
      description: description || undefined,
      name,
      fields,
    });
  }

  collectFields(
    node: ts.ClassDeclaration | ts.InterfaceDeclaration,
  ): Array<FieldDefinitionNode> {
    const fields: FieldDefinitionNode[] = [];
    ts.forEachChild(node, (node) => {
      if (ts.isMethodDeclaration(node)) {
        const field = this.methodDeclaration(node);
        if (field) {
          fields.push(field);
        }
      } else if (
        ts.isPropertyDeclaration(node) ||
        ts.isPropertySignature(node)
      ) {
        const field = this.property(node);
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

    let defaults: ArgDefaults | null = null;
    if (ts.isObjectBindingPattern(argsParam.name)) {
      defaults = this.collectArgDefaults(argsParam.name);
    }

    for (const member of argsType.members) {
      const arg = this.collectArg(member, defaults);
      if (arg != null) {
        args.push(arg);
      }
    }
    return args;
  }

  collectArgDefaults(node: ts.ObjectBindingPattern): ArgDefaults {
    const defaults = new Map();
    for (const element of node.elements) {
      if (
        ts.isBindingElement(element) &&
        element.initializer &&
        ts.isIdentifier(element.name)
      ) {
        defaults.set(element.name.text, element.initializer);
      }
    }
    return defaults;
  }

  collectConstValue(node: ts.Expression): ConstValueNode | null {
    if (ts.isStringLiteral(node)) {
      return { kind: Kind.STRING, loc: this.loc(node), value: node.text };
    } else if (ts.isNumericLiteral(node)) {
      const kind = node.text.includes(".") ? Kind.FLOAT : Kind.INT;
      return { kind, loc: this.loc(node), value: node.text };
    } else if (this.isNullish(node)) {
      return { kind: Kind.NULL, loc: this.loc(node) };
    }
    // FIXME: Obeject literals, arrays, etc.
    this.reportUnhandled(
      node,
      "Expected GraphQL field argument default values to be a literal.",
    );
    return null;
  }

  collectArg(
    node: ts.TypeElement,
    defaults?: Map<string, ts.Expression> | null,
  ): InputValueDefinitionNode | null {
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

    if (node.type == null) {
      this.report(node.name, "Expected GraphQL field argument to have a type.");
      return null;
    }
    const type = this.collectInputType(node.type);
    if (type == null) return null;
    const description = this.collectDescription(node.name);

    let defaultValue: ConstValueNode | null = null;
    if (defaults != null) {
      const def = defaults.get(node.name.text);
      if (def != null) {
        defaultValue = this.collectConstValue(def);
      }
    }
    return {
      kind: Kind.INPUT_VALUE_DEFINITION,
      loc: this.loc(node),
      description: description || undefined,
      name: this.gqlName(node.name, node.name.text),
      // FIXME: Correctly detect nullable types
      type: this.gqlNonNullType(node.type, type),
      defaultValue: defaultValue || undefined,
      directives: [],
    };
  }

  entityName(
    node:
      | ts.ClassDeclaration
      | ts.MethodDeclaration
      | ts.PropertyDeclaration
      | ts.InterfaceDeclaration
      | ts.PropertySignature,
    tag: ts.JSDocTag,
  ) {
    if (tag.comment != null) {
      const commentName = ts.getTextOfJSDocComment(tag.comment);
      if (commentName != null) {
        return this.gqlName(tag, commentName);
      }
    }

    if (node.name == null) {
      this.report(node, "Expected GraphQL entity to have a name.");
      return null;
    }
    const id = this.expectIdentifier(node.name);
    if (id == null) return null;
    return this.gqlName(id, id.text);
  }

  methodDeclaration(node: ts.MethodDeclaration): FieldDefinitionNode | null {
    const tag = this.findTag(node, "GQLField");
    if (tag == null) return null;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      this.report(node, "Expected GraphQL field to have a type.");
      return null;
    }

    const type = this.collectType(node.type);

    // We already reported an error
    if (type == null) return null;

    const args = this.collectArgs(node);

    const description = this.collectDescription(node.name);

    const id = this.expectIdentifier(node.name);
    if (id == null) return null;
    let directives: ConstDirectiveNode[] | null = null;
    if (id.text !== name.value) {
      directives = [
        this.gqlConstDirective(
          node.name,
          this.gqlName(node.name, "renameField"),
          [
            this.gqlConstArgument(
              node.name,
              this.gqlName(node.name, "name"),
              this.gqlString(node.name, id.text),
            ),
          ],
        ),
      ];
    }

    return {
      kind: Kind.FIELD_DEFINITION,
      loc: this.loc(node),
      description: description || undefined,
      name,
      arguments: args || undefined,
      type,
      directives: directives || undefined,
    };
  }

  collectDescription(node: ts.Node): StringValueNode | null {
    const symbol = this.ctx.checker.getSymbolAtLocation(node);
    if (symbol == null) {
      this.report(
        node,
        "Expected TypeScript to be able to resolve this GraphQL entity to a symbol.",
      );
      return null;
    }
    const doc = symbol.getDocumentationComment(this.ctx.checker);
    const description = ts.displayPartsToString(doc);
    if (description) {
      return { kind: Kind.STRING, loc: this.loc(node), value: description };
    }
    return null;
  }

  property(
    node: ts.PropertyDeclaration | ts.PropertySignature,
  ): FieldDefinitionNode | null {
    const tag = this.findTag(node, "GQLField");
    if (tag == null) return null;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      this.report(node, "Expected GraphQL field to have a type.");
      return null;
    }

    const type = this.collectType(node.type);

    // We already reported an error
    if (type == null) return null;
    const description = this.collectDescription(node.name);

    let directives: ConstDirectiveNode[] | null = null;
    const id = this.expectIdentifier(node.name);
    if (id == null) return null;

    if (id.text !== name.value) {
      directives = [
        this.gqlConstDirective(
          node.name,
          this.gqlName(node.name, "renameField"),
          [
            this.gqlConstArgument(
              node.name,
              this.gqlName(node.name, "name"),
              this.gqlString(node.name, id.text),
            ),
          ],
        ),
      ];
    }

    return {
      kind: Kind.FIELD_DEFINITION,
      loc: this.loc(node),
      description: description || undefined,
      name,
      arguments: undefined,
      type,
      directives: directives || undefined,
    };
  }

  collectInputType(node: ts.TypeNode): NamedTypeNode | ListTypeNode | null {
    if (ts.isOptionalTypeNode(node)) {
    }
    if (ts.isTypeReferenceNode(node)) {
      // FIXME: Validate type reference
      return this.gqlNamedType(node, node.typeName.getText());
    } else if (ts.isArrayTypeNode(node)) {
      const element = this.collectInputType(node.elementType);
      if (element == null) return null;
      return this.gqlListType(node, element);
    } else if (node.kind === ts.SyntaxKind.StringKeyword) {
      return this.gqlNamedType(node, "String");
    } else if (ts.isUnionTypeNode(node)) {
      const types = node.types.filter((type) => !this.isNullish(type));
      if (types.length !== 1) {
        this.report(node, `Expected exactly one non-nullish type.`);
        return null;
      }
      return this.collectInputType(types[0]);
    }
    this.reportUnhandled(node, `Unknown GraphQL type.`);
    return null;
  }

  collectType(node: ts.TypeNode): TypeNode | null {
    if (ts.isTypeReferenceNode(node)) {
      return this.typeReference(node);
    } else if (ts.isArrayTypeNode(node)) {
      const element = this.collectType(node.elementType);
      if (element == null) return null;
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
        if (node.typeArguments == null) {
          this.report(node, `Expected type reference to have type arguments.`);
          return null;
        }
        return this.collectType(node.typeArguments[0]);
      case "Array":
      case "Iterator":
      case "ReadonlyArray":
        if (node.typeArguments == null) {
          this.report(node, `Expected type reference to have type arguments.`);
          return null;
        }
        const element = this.collectType(node.typeArguments[0]);
        if (element == null) return null;
        return this.gqlListType(node, element);
      default:
        // We may not have encountered the definition of this type yet. So, we
        // mark it as unresolved and return a placeholder type.
        //
        // A later pass will resolve the type.
        const namedType = this.gqlNamedType(node, UNRESOLVED_REFERENCE_NAME);
        this.ctx.markUnresolvedType(node.typeName, namedType);
        return namedType;
    }
  }

  isNullish(node: ts.Node): boolean {
    if (ts.isIdentifier(node)) {
      return node.escapedText === "undefined";
    }
    if (ts.isLiteralTypeNode(node)) {
      return (
        node.literal.kind === ts.SyntaxKind.NullKeyword ||
        node.literal.kind === ts.SyntaxKind.UndefinedKeyword
      );
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

  gqlConstArgument(
    node: ts.Node,
    name: NameNode,
    value: ConstValueNode,
  ): ConstArgumentNode {
    return { kind: Kind.ARGUMENT, loc: this.loc(node), name, value };
  }

  gqlConstDirective(
    node: ts.Node,
    name: NameNode,
    args: ReadonlyArray<ConstArgumentNode>,
  ): ConstDirectiveNode {
    return { kind: Kind.DIRECTIVE, loc: this.loc(node), name, arguments: args };
  }
  gqlString(node: ts.Node, value: string): StringValueNode {
    return { kind: Kind.STRING, loc: this.loc(node), value };
  }
}
