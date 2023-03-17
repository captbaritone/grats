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
  EnumValueDefinitionNode,
  DirectiveNode,
} from "graphql";
import { Position } from "./utils/Location";
import DiagnosticError, { AnnotatedLocation } from "./utils/DiagnosticError";
import * as ts from "typescript";
import { TypeContext, UNRESOLVED_REFERENCE_NAME } from "./TypeContext";

const LIBRARY_IMPORT_NAME = "<library import name>";
const LIBRARY_NAME = "<library name>";
const ISSUE_URL = "<issue URL>";

const TYPE_TAG = "GQLType";
const FIELD_TAG = "GQLField";
const SCALAR_TAG = "GQLScalar";
const INTERFACE_TAG = "GQLInterface";
const ENUM_TAG = "GQLEnum";
const UNION_TAG = "GQLUnion";
const INPUT_TAG = "GQLInput";

const DEPRECATED_TAG = "deprecated";

type ArgDefaults = Map<string, ts.Expression>;

/**
 * Extracts GraphQL definitions from TypeScript source code.
 *
 * Note that we extract a GraphQL AST with the AST nodes' location information
 * populated with references to the TypeScript code from which the types were
 * derived.
 *
 * This ensures that we can apply GraphQL schema validation rules, and any reported
 * errors will point to the correct location in the TypeScript source code.
 */
export class Extractor {
  definitions: DefinitionNode[] = [];
  sourceFile: ts.SourceFile;
  ctx: TypeContext;
  errors: DiagnosticError[] = [];

  constructor(sourceFile: ts.SourceFile, ctx: TypeContext) {
    this.sourceFile = sourceFile;
    this.ctx = ctx;
  }

  // Traverse all nodes, checking each one for its JSDoc tags.
  // If we find a tag we recognize, we extract the relevant information,
  // reporting an error if it is attached to a node where that tag is not
  // supported.
  extract(): DefinitionNode[] {
    ts.forEachChild(this.sourceFile, (node) => {
      for (const tag of ts.getJSDocTags(node)) {
        switch (tag.tagName.text) {
          case TYPE_TAG:
            this.extractType(node, tag);
            break;
          case SCALAR_TAG:
            this.extractScalar(node, tag);
            break;
          case FIELD_TAG:
            // Right now this happens via deep traversal
            // TODO: Handle GQLField as part of this top level traversal
            // by keeping track of the current type we're in and appending fields
            // as we go.
            break;
          case INTERFACE_TAG:
            this.extractInterface(node, tag);
            break;
          case ENUM_TAG:
            this.extractEnum(node, tag);
            break;
          case INPUT_TAG:
            this.extractInput(node, tag);
            break;

          case UNION_TAG:
            this.reportUnhandled(
              tag,
              `\`@${UNION_TAG}\` is not yet implemented.`,
            );
            break;
        }
      }
    });
    if (this.errors.length > 0) {
      // TODO: Ideally we could report all errors
      throw this.errors[0];
    }
    return this.definitions;
  }

  extractType(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isClassDeclaration(node)) {
      this.typeClassDeclaration(node, tag);
    } else {
      this.report(
        tag,
        `\`@${TYPE_TAG}\` can only be used on class declarations.`,
      );
    }
  }

  extractScalar(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isTypeAliasDeclaration(node)) {
      this.scalarTypeAliasDeclaration(node, tag);
    } else {
      this.report(
        tag,
        `\`@${SCALAR_TAG}\` can only be used on type alias declarations.`,
      );
    }
  }

  extractInterface(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isInterfaceDeclaration(node)) {
      this.interfaceInterfaceDeclaration(node, tag);
    } else {
      this.report(
        tag,
        `\`@${INTERFACE_TAG}\` can only be used on interface declarations.`,
      );
    }
  }

  extractEnum(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isEnumDeclaration(node)) {
      this.enumEnumDeclaration(node, tag);
    } else if (ts.isTypeAliasDeclaration(node)) {
      this.enumTypeAliasDeclaration(node, tag);
    } else {
      this.report(
        tag,
        `\`@${ENUM_TAG}\` can only be used on enum declarations.`,
      );
    }
  }

  extractInput(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isTypeAliasDeclaration(node)) {
      this.inputTypeAliasDeclaration(node, tag);
    } else {
      this.report(
        tag,
        `\`@${INPUT_TAG}\` can only be used on type alias declarations.`,
      );
    }
  }

  /** Error handling and location juggling */

  report(node: ts.Node, message: string) {
    this.errors.push(
      new DiagnosticError(message, this.diagnosticAnnotatedLocation(node)),
    );
  }

  // Report an error that we don't know how to infer a type, but it's possible that we should.
  // Gives the user a path forward if they think we should be able to infer this type.
  reportUnhandled(node: ts.Node, message: string) {
    const suggestion = `If you think ${LIBRARY_NAME} should be able to infer this type, please report an issue at ${ISSUE_URL}.`;
    this.errors.push(
      new DiagnosticError(
        `${message}\n\n${suggestion}`,
        this.diagnosticAnnotatedLocation(node),
      ),
    );
  }

  diagnosticAnnotatedLocation(node: ts.Node): AnnotatedLocation {
    const start = this.diagnosticPosition(node.getStart());
    const end = this.diagnosticPosition(node.getEnd());
    return new AnnotatedLocation(
      { start, end, filepath: this.sourceFile.fileName },
      "",
    );
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

  scalarTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    const description = this.collectDescription(node.name);
    this.ctx.recordTypeName(node.name, name.value);

    this.definitions.push({
      kind: Kind.SCALAR_TYPE_DEFINITION,
      loc: this.loc(node),
      description: description ?? undefined,
      name,
    });
  }

  inputTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    const description = this.collectDescription(node.name);
    this.ctx.recordTypeName(node.name, name.value);

    const fields = this.collectInputFields(node);

    this.definitions.push({
      kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
      loc: this.loc(node),
      description: description ?? undefined,
      name,
      fields: fields ?? undefined,
    });
  }

  collectInputFields(
    node: ts.TypeAliasDeclaration,
  ): Array<InputValueDefinitionNode> | null {
    const fields: Array<InputValueDefinitionNode> = [];

    if (!ts.isTypeLiteralNode(node.type)) {
      this.reportUnhandled(
        node,
        `\`@${INPUT_TAG}\` can only be used on type literals.`,
      );
      return null;
    }

    for (const member of node.type.members) {
      if (!ts.isPropertySignature(member)) {
        this.reportUnhandled(
          member,
          `\`@${INPUT_TAG}\` types only support property signature members.`,
        );
        continue;
      }
      const field = this.collectInputField(member);
      if (field != null) fields.push(field);
    }

    return fields.length === 0 ? null : fields;
  }

  collectInputField(
    node: ts.PropertySignature,
  ): InputValueDefinitionNode | null {
    const id = this.expectIdentifier(node.name);
    if (id == null) return null;

    if (node.type == null) {
      this.report(node, "Input field must have a type annotation.");
      return null;
    }

    const inner = this.collectType(node.type);
    if (inner == null) return null;

    const type =
      node.questionToken == null ? inner : this.gqlNullableType(inner);

    const description = this.collectDescription(node.name);

    return {
      kind: Kind.INPUT_VALUE_DEFINITION,
      loc: this.loc(node),
      description: description ?? undefined,
      name: this.gqlName(id, id.text),
      type,
      defaultValue: undefined,
      directives: undefined,
    };
  }

  typeClassDeclaration(node: ts.ClassDeclaration, tag: ts.JSDocTag) {
    if (node.name == null) {
      this.report(
        node,
        `Unexpected \`@${TYPE_TAG}\` annotation on unnamed class declaration.`,
      );
      return null;
    }

    const name = this.entityName(node, tag);
    if (name == null) return null;

    const description = this.collectDescription(node.name);
    const fields = this.collectFields(node);
    const interfaces = this.collectInterfaces(node);
    this.ctx.recordTypeName(node.name, name.value);

    this.definitions.push({
      kind: Kind.OBJECT_TYPE_DEFINITION,
      loc: this.loc(node),
      description: description ?? undefined,
      directives: undefined,
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

  interfaceInterfaceDeclaration(
    node: ts.InterfaceDeclaration,
    tag: ts.JSDocTag,
  ) {
    const name = this.entityName(node, tag);
    if (name == null || name.value == null) {
      return;
    }
    const description = this.collectDescription(node.name);

    const fields = this.collectFields(node);

    this.ctx.recordTypeName(node.name, name.value);

    // While GraphQL supports interfaces that extend other interfaces,
    // TypeScript does not. So we can't support that here either.

    // In the future we could support classes that act as interfaces through
    // inheritance.

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
        "Expected GraphQL field arguments to have a TypeScript type. If there are no arguments, you can use `args: never`.",
      );
      return null;
    }
    if (argsType.kind === ts.SyntaxKind.NeverKeyword) {
      return [];
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
      // TODO: How can I create this error?
      this.report(
        node,
        "Expected GraphQL field argument type to be a property signature.",
      );
      return null;
    }
    if (!ts.isIdentifier(node.name)) {
      // TODO: How can I create this error?
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
    const type = this.collectType(node.type);
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
      type,
      defaultValue: defaultValue || undefined,
      directives: [],
    };
  }

  enumEnumDeclaration(node: ts.EnumDeclaration, tag: ts.JSDocTag): void {
    const name = this.entityName(node, tag);
    if (name == null || name.value == null) {
      return;
    }
    const description = this.collectDescription(node.name);

    const values = this.collectEnumValues(node);

    this.ctx.recordTypeName(node.name, name.value);

    this.definitions.push({
      kind: Kind.ENUM_TYPE_DEFINITION,
      loc: this.loc(node),
      description: description || undefined,
      name,
      values,
    });
  }

  enumTypeAliasDeclaration(
    node: ts.TypeAliasDeclaration,
    tag: ts.JSDocTag,
  ): void {
    const name = this.entityName(node, tag);
    if (name == null || name.value == null) {
      return;
    }
    if (!ts.isUnionTypeNode(node.type)) {
      this.reportUnhandled(
        node.type,
        `Expected \`@${ENUM_TAG}\` to be a union type.`,
      );
      return;
    }

    const description = this.collectDescription(node.name);

    const values: EnumValueDefinitionNode[] = [];
    for (const member of node.type.types) {
      if (
        !ts.isLiteralTypeNode(member) ||
        !ts.isStringLiteral(member.literal)
      ) {
        this.reportUnhandled(
          member,
          `Expected \`@${ENUM_TAG}\` enum members to be string literal types. For example: \`'foo'\`.`,
        );
        continue;
      }

      // TODO: Support descriptions on enum members. As it stands, TypeScript
      // does not allow comments attached to string literal types.
      values.push({
        kind: Kind.ENUM_VALUE_DEFINITION,
        name: this.gqlName(member.literal, member.literal.text),
        description: description || undefined,
        loc: this.loc(member),
      });
    }

    this.ctx.recordTypeName(node.name, name.value);

    this.definitions.push({
      kind: Kind.ENUM_TYPE_DEFINITION,
      loc: this.loc(node),
      description: description || undefined,
      name,
      values,
    });
  }

  collectEnumValues(
    node: ts.EnumDeclaration,
  ): ReadonlyArray<EnumValueDefinitionNode> {
    const values: EnumValueDefinitionNode[] = [];

    for (const member of node.members) {
      if (
        member.initializer == null ||
        !ts.isStringLiteral(member.initializer)
      ) {
        this.reportUnhandled(
          member,
          `Expected \`@${ENUM_TAG}\` enum members to have string literal initializers. For example: \`FOO = 'foo'\`.`,
        );
        continue;
      }

      const description = this.collectDescription(member.name);
      const deprecated = this.collectDeprecated(member);
      values.push({
        kind: Kind.ENUM_VALUE_DEFINITION,
        loc: this.loc(member),
        description: description || undefined,
        name: this.gqlName(member.initializer, member.initializer.text),
        directives: deprecated ? [deprecated] : undefined,
      });
    }

    return values;
  }

  entityName(
    node:
      | ts.ClassDeclaration
      | ts.MethodDeclaration
      | ts.PropertyDeclaration
      | ts.InterfaceDeclaration
      | ts.PropertySignature
      | ts.EnumDeclaration
      | ts.TypeAliasDeclaration,
    tag: ts.JSDocTag,
  ) {
    if (tag.comment != null) {
      const commentName = ts.getTextOfJSDocComment(tag.comment);
      if (commentName != null) {
        // FIXME: Use the _value_'s location not the tag's
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
    const tag = this.findTag(node, FIELD_TAG);
    if (tag == null) return null;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      this.report(node.name, "Expected GraphQL field to have a type.");
      return null;
    }

    const type = this.collectType(node.type);

    // We already reported an error
    if (type == null) return null;

    const args = this.collectArgs(node);

    const description = this.collectDescription(node.name);

    const id = this.expectIdentifier(node.name);
    if (id == null) return null;
    let directives: ConstDirectiveNode[] = [];
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

    const deprecated = this.collectDeprecated(node);
    if (deprecated != null) {
      directives.push(deprecated);
    }

    return {
      kind: Kind.FIELD_DEFINITION,
      loc: this.loc(node),
      description: description || undefined,
      name,
      arguments: args || undefined,
      type: this.handleErrorBubbling(type),
      directives: directives.length === 0 ? undefined : directives,
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

  collectDeprecated(node: ts.Node): ConstDirectiveNode | null {
    const tag = this.findTag(node, DEPRECATED_TAG);
    if (tag == null) return null;
    let reason: ConstArgumentNode | null = null;
    if (tag.comment != null) {
      const reasonComment = ts.getTextOfJSDocComment(tag.comment);
      if (reasonComment != null) {
        // FIXME: Use the _value_'s location not the tag's
        reason = this.gqlConstArgument(
          tag,
          this.gqlName(tag, "reason"),
          this.gqlString(tag, reasonComment),
        );
      }
    }
    const args = reason == null ? undefined : [reason];
    return {
      kind: Kind.DIRECTIVE,
      loc: this.loc(tag),
      name: this.gqlName(tag, DEPRECATED_TAG),
      arguments: args,
    };
  }

  property(
    node: ts.PropertyDeclaration | ts.PropertySignature,
  ): FieldDefinitionNode | null {
    const tag = this.findTag(node, FIELD_TAG);
    if (tag == null) return null;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      this.report(node.name, "Expected GraphQL field to have a type.");
      return null;
    }

    const inner = this.collectType(node.type);
    // We already reported an error
    if (inner == null) return null;
    const type =
      node.questionToken == null ? inner : this.gqlNullableType(inner);

    const description = this.collectDescription(node.name);

    let directives: ConstDirectiveNode[] = [];
    const id = this.expectIdentifier(node.name);
    if (id == null) return null;

    const deprecated = this.collectDeprecated(node);
    if (deprecated != null) {
      directives.push(deprecated);
    }

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
      type: this.handleErrorBubbling(type),
      directives: directives.length === 0 ? undefined : directives,
    };
  }

  collectType(node: ts.TypeNode): TypeNode | null {
    if (ts.isTypeReferenceNode(node)) {
      const type = this.typeReference(node);
      if (type == null) return null;
      return this.gqlNonNullType(node, type);
    } else if (ts.isArrayTypeNode(node)) {
      const element = this.collectType(node.elementType);
      if (element == null) return null;
      return this.gqlNonNullType(node, this.gqlListType(node, element));
    } else if (ts.isUnionTypeNode(node)) {
      const types = node.types.filter((type) => !this.isNullish(type));
      if (types.length !== 1) {
        this.report(node, `Expected exactly one non-nullish type.`);
        return null;
      }
      const type = this.collectType(types[0]);
      if (type == null) return null;
      if (node.types.length > 1) {
        return this.gqlNullableType(type);
      }
      return this.gqlNonNullType(node, type);
    } else if (node.kind === ts.SyntaxKind.StringKeyword) {
      return this.gqlNonNullType(node, this.gqlNamedType(node, "String"));
    } else if (node.kind === ts.SyntaxKind.NumberKeyword) {
      this.report(
        node,
        `Unexpected number type. GraphQL supports both Int and Float, making \`number\` ambiguous. Instead, import the \`Int\` or \`Float\` type from \`${LIBRARY_IMPORT_NAME}\` and use that.`,
      );
      return null;
    } else if (ts.isTypeLiteralNode(node)) {
      this.report(
        node,
        `Unexpected type literal. You may want to define a named GraphQL type elsewhere and reference it here.`,
      );
      return null;
    }
    // TODO: Better error message. This is okay if it's a type reference, but everything else is not.
    this.reportUnhandled(node, `Unknown GraphQL type.`);
    return null;
  }

  typeReference(node: ts.TypeReferenceNode): TypeNode | null {
    const identifier = this.expectIdentifier(node.typeName);
    if (identifier == null) return null;

    const typeName = identifier.text;
    switch (typeName) {
      case "Promise": {
        if (node.typeArguments == null) {
          this.report(node, `Expected type reference to have type arguments.`);
          return null;
        }
        const type = this.collectType(node.typeArguments[0]);
        if (type == null) return null;
        return this.gqlNonNullType(node, type);
      }
      case "Array":
      case "Iterator":
      case "ReadonlyArray": {
        if (node.typeArguments == null) {
          this.report(node, `Expected type reference to have type arguments.`);
          return null;
        }
        const element = this.collectType(node.typeArguments[0]);
        if (element == null) return null;
        return this.gqlNonNullType(node, this.gqlListType(node, element));
      }
      default: {
        // We may not have encountered the definition of this type yet. So, we
        // mark it as unresolved and return a placeholder type.
        //
        // A later pass will resolve the type.
        const namedType = this.gqlNamedType(node, UNRESOLVED_REFERENCE_NAME);
        this.ctx.markUnresolvedType(node.typeName, namedType);
        return this.gqlNonNullType(node, namedType);
      }
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

  // It is a GraphQL best practice to model all fields as nullable. This allows
  // the server to handle field level exections by simply returning null for
  // that field. However, I suspect not everybody wants this behavior, so...
  // TODO: Make this configurable.
  handleErrorBubbling(type: TypeNode) {
    return this.gqlNullableType(type);
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
  gqlNonNullType(node: ts.Node, type: TypeNode): NonNullTypeNode {
    if (type.kind === Kind.NON_NULL_TYPE) {
      return type;
    }
    return { kind: Kind.NON_NULL_TYPE, loc: this.loc(node), type };
  }
  gqlNullableType(type: TypeNode): NamedTypeNode | ListTypeNode {
    let inner = type;
    while (inner.kind === Kind.NON_NULL_TYPE) {
      inner = inner.type;
    }
    return inner;
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
