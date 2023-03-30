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
  ConstObjectFieldNode,
  ConstObjectValueNode,
} from "graphql";
import {
  DiagnosticsResult,
  err,
  FAKE_ERROR_CODE,
  ok,
} from "./utils/DiagnosticError";
import * as ts from "typescript";
import { TypeContext, UNRESOLVED_REFERENCE_NAME } from "./TypeContext";
import { ConfigOptions } from "./lib";
import {
  EXPORTED_DIRECTIVE,
  EXPORTED_FILENAME_ARG,
  EXPORTED_FUNCTION_NAME_ARG,
  METHOD_NAME_ARG,
  METHOD_NAME_DIRECTIVE,
} from "./serverDirectives";

const LIBRARY_IMPORT_NAME = "grats";
const LIBRARY_NAME = "Grats";
const ISSUE_URL = "https://github.com/captbaritone/grats/issues";

const TYPE_TAG = "gqlType";
const FIELD_TAG = "gqlField";
const SCALAR_TAG = "gqlScalar";
const INTERFACE_TAG = "gqlInterface";
const ENUM_TAG = "gqlEnum";
const UNION_TAG = "gqlUnion";
const INPUT_TAG = "gqlInput";

const ALL_TAGS = [
  TYPE_TAG,
  FIELD_TAG,
  SCALAR_TAG,
  INTERFACE_TAG,
  ENUM_TAG,
  UNION_TAG,
  INPUT_TAG,
];

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
  configOptions: ConfigOptions;
  errors: ts.Diagnostic[] = [];

  constructor(
    sourceFile: ts.SourceFile,
    ctx: TypeContext,
    buildOptions: ConfigOptions,
  ) {
    this.sourceFile = sourceFile;
    this.ctx = ctx;
    this.configOptions = buildOptions;
  }

  // Traverse all nodes, checking each one for its JSDoc tags.
  // If we find a tag we recognize, we extract the relevant information,
  // reporting an error if it is attached to a node where that tag is not
  // supported.
  extract(): DiagnosticsResult<DefinitionNode[]> {
    ts.forEachChild(this.sourceFile, (node) => {
      for (const tag of ts.getJSDocTags(node)) {
        switch (tag.tagName.text) {
          case TYPE_TAG:
            this.extractType(node, tag);
            break;
          case SCALAR_TAG:
            this.extractScalar(node, tag);
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
            this.extractUnion(node, tag);
            break;
          case FIELD_TAG:
            if (ts.isFunctionDeclaration(node)) {
              this.functionDeclarationExtendType(node, tag);
            } else if (
              !(
                ts.isMethodDeclaration(node) ||
                ts.isPropertyDeclaration(node) ||
                ts.isMethodSignature(node) ||
                ts.isPropertySignature(node)
              )
            ) {
              // Right now this happens via deep traversal
              // Note: Keep this in sync with `collectFields`
              this.reportUnhandled(
                node,
                `\`@${FIELD_TAG}\` can only be used on method/property declarations or signatures.`,
              );
            }
            break;
          default:
            const lowerCaseTag = tag.tagName.text.toLowerCase();
            if (lowerCaseTag.startsWith("gql")) {
              for (const t of ALL_TAGS) {
                if (t.toLowerCase() === lowerCaseTag) {
                  this.report(
                    tag.tagName,
                    `Incorrect casing for Grats tag \`@${tag.tagName.text}\`. Use \`@${t}\` instead.`,
                  );
                  break;
                }
              }
              this.report(
                tag.tagName,
                `\`@${
                  tag.tagName.text
                }\` is not a valid Grats tag. Valid tags are: ${ALL_TAGS.map(
                  (t) => `\`@${t}\``,
                ).join(", ")}.`,
              );
            }
            break;
        }
      }
    });
    if (this.errors.length > 0) {
      return err(this.errors);
    }
    return ok(this.definitions);
  }

  extractType(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isClassDeclaration(node)) {
      this.typeClassDeclaration(node, tag);
    } else if (ts.isInterfaceDeclaration(node)) {
      this.typeInterfaceDeclaration(node, tag);
    } else if (ts.isTypeAliasDeclaration(node)) {
      this.typeTypeAliasDeclaration(node, tag);
    } else {
      this.report(
        tag,
        `\`@${TYPE_TAG}\` can only be used on class or interface declarations.`,
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
        `\`@${ENUM_TAG}\` can only be used on enum declarations or TypeScript unions.`,
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

  extractUnion(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isTypeAliasDeclaration(node)) {
      this.unionTypeAliasDeclaration(node, tag);
    } else {
      this.report(
        tag,
        `\`@${UNION_TAG}\` can only be used on type alias declarations.`,
      );
    }
  }

  /** Error handling and location juggling */

  report(node: ts.Node, message: string): null {
    const start = node.getStart();
    const length = node.getEnd() - start;
    this.errors.push({
      messageText: message,
      file: this.sourceFile,
      code: FAKE_ERROR_CODE,
      category: ts.DiagnosticCategory.Error,
      start,
      length,
    });
    return null;
  }

  // Report an error that we don't know how to infer a type, but it's possible that we should.
  // Gives the user a path forward if they think we should be able to infer this type.
  reportUnhandled(node: ts.Node, message: string): null {
    const suggestion = `If you think ${LIBRARY_NAME} should be able to infer this type, please report an issue at ${ISSUE_URL}.`;
    const completedMessage = `${message}\n\n${suggestion}`;
    this.report(node, completedMessage);
    return null;
  }

  diagnosticAnnotatedLocation(node: ts.Node): {
    start: number;
    length: number;
    filepath: ts.SourceFile;
  } {
    const start = node.getStart();
    const end = node.getEnd();
    return { start, length: end - start, filepath: this.sourceFile };
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

  unionTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (!ts.isUnionTypeNode(node.type)) {
      return this.report(
        node,
        `Expected a TypeScript union. \`@${UNION_TAG}\` can only be used on TypeScript unions.`,
      );
    }
    const description = this.collectDescription(node.name);

    const types: NamedTypeNode[] = [];
    for (const member of node.type.types) {
      if (!ts.isTypeReferenceNode(member)) {
        return this.reportUnhandled(
          member,
          `Expected \`@${UNION_TAG}\` union members to be type references.`,
        );
      }
      const namedType = this.gqlNamedType(
        member.typeName,
        UNRESOLVED_REFERENCE_NAME,
      );
      this.ctx.markUnresolvedType(member.typeName, namedType.name);
      types.push(namedType);
    }

    this.ctx.recordTypeName(node.name, name.value);

    this.definitions.push({
      kind: Kind.UNION_TYPE_DEFINITION,
      loc: this.loc(node),
      description: description ?? undefined,
      name: name,
      types,
    });
  }

  functionDeclarationExtendType(
    node: ts.FunctionDeclaration,
    tag: ts.JSDocTag,
  ) {
    const funcName = this.namedFunctionExportName(node);
    if (funcName == null) return null;

    const typeParam = node.parameters[0];
    if (typeParam == null) {
      return this.report(
        funcName,
        `Expected \`@${FIELD_TAG}\` function to have a first argument representing the type to extend.`,
      );
    }

    const typeName = this.typeReferenceFromParam(typeParam);
    if (typeName == null) return null;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      return this.report(
        funcName,
        "Expected GraphQL field to have an explicit return type.",
      );
    }

    const type = this.collectType(node.type);
    if (type == null) return null;

    let args: readonly InputValueDefinitionNode[] | null = null;
    const argsParam = node.parameters[1];
    if (argsParam != null) {
      args = this.collectArgs(argsParam);
    }

    const description = this.collectDescription(funcName);

    if (!ts.isSourceFile(node.parent)) {
      return this.report(
        node,
        `Expected \`@${FIELD_TAG}\` function to be a top-level declaration.`,
      );
    }

    // TODO: Does this work in the browser?
    const filename = this.ctx.getDestFilePath(node.parent);

    let directives = [this.exportDirective(funcName, filename, funcName.text)];

    if (funcName.text !== name.value) {
      directives.push(this.methodNameDirective(funcName, funcName.text));
    }

    const deprecated = this.collectDeprecated(node);
    if (deprecated != null) {
      directives.push(deprecated);
    }

    this.definitions.push({
      kind: Kind.OBJECT_TYPE_EXTENSION,
      loc: this.loc(node),
      name: typeName,
      fields: [
        {
          kind: Kind.FIELD_DEFINITION,
          loc: this.loc(node),
          description: description || undefined,
          name,
          arguments: args || undefined,
          type: this.handleErrorBubbling(type),
          directives: directives.length === 0 ? undefined : directives,
        },
      ],
    });
  }

  typeReferenceFromParam(typeParam: ts.ParameterDeclaration): NameNode | null {
    if (typeParam.type == null) {
      return this.report(
        typeParam,
        `Expected first argument of a \`@${FIELD_TAG}\` function to have an explicit type annotation.`,
      );
    }
    if (!ts.isTypeReferenceNode(typeParam.type)) {
      return this.report(
        typeParam.type,
        `Expected first argument of a \`@${FIELD_TAG}\` function to be typed as a \`@gqlType\` type.`,
      );
    }

    const nameNode = typeParam.type.typeName;
    const typeName = this.gqlName(nameNode, UNRESOLVED_REFERENCE_NAME);
    this.ctx.markUnresolvedType(nameNode, typeName);
    return typeName;
  }

  namedFunctionExportName(node: ts.FunctionDeclaration): ts.Identifier | null {
    if (node.name == null) {
      return this.report(
        node,
        `Expected a \`@${FIELD_TAG}\` function to be a named function.`,
      );
    }
    const exportKeyword = node.modifiers?.some((modifier) => {
      return modifier.kind === ts.SyntaxKind.ExportKeyword;
    });
    const defaultKeyword = node.modifiers?.find((modifier) => {
      return modifier.kind === ts.SyntaxKind.DefaultKeyword;
    });

    if (defaultKeyword != null) {
      // TODO: We could support this
      return this.report(
        defaultKeyword,
        `Expected a \`@${FIELD_TAG}\` function to be a named export, not a default export.`,
      );
    }

    if (exportKeyword == null) {
      return this.report(
        node.name,
        `Expected a \`@${FIELD_TAG}\` function to be a named export.`,
      );
    }
    return node.name;
  }

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
      return this.reportUnhandled(
        node,
        `\`@${INPUT_TAG}\` can only be used on type literals.`,
      );
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
      return this.report(node, "Input field must have a type annotation.");
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
      return this.report(
        node,
        `Unexpected \`@${TYPE_TAG}\` annotation on unnamed class declaration.`,
      );
    }

    const name = this.entityName(node, tag);
    if (name == null) return null;

    const description = this.collectDescription(node.name);
    const fields = this.collectFields(node);
    const interfaces = this.collectInterfaces(node);
    this.ctx.recordTypeName(node.name, name.value);

    this.checkForTypenameProperty(node, name.value);

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

  typeInterfaceDeclaration(node: ts.InterfaceDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    const description = this.collectDescription(node.name);
    const fields = this.collectFields(node);
    const interfaces = this.collectInterfaces(node);
    this.ctx.recordTypeName(node.name, name.value);

    this.checkForTypenameProperty(node, name.value);

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

  typeTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (!ts.isTypeLiteralNode(node.type)) {
      this.reportUnhandled(
        node.type,
        `Expected \`@${TYPE_TAG}\` type to be a type literal. For example: \`type Foo = { bar: string }\``,
      );
      return;
    }

    const description = this.collectDescription(node.name);
    const fields = this.collectFields(node.type);
    this.ctx.recordTypeName(node.name, name.value);

    this.checkForTypenameProperty(node.type, name.value);

    this.definitions.push({
      kind: Kind.OBJECT_TYPE_DEFINITION,
      loc: this.loc(node),
      description: description ?? undefined,
      directives: undefined,
      name,
      fields,
      // I don't believe there is a reasonable way to specify that a type
      // implements an interface.
      interfaces: undefined,
    });
  }

  checkForTypenameProperty(
    node: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeLiteralNode,
    expectedName: string,
  ) {
    const hasTypename = node.members.some((member) => {
      return this.isValidTypeNameProperty(member, expectedName);
    });
    if (hasTypename) {
      this.ctx.recordHasTypenameField(expectedName);
    }
  }

  isValidTypeNameProperty(
    member: ts.ClassElement | ts.TypeElement,
    expectedName: string,
  ) {
    if (
      member.name == null ||
      !ts.isIdentifier(member.name) ||
      member.name.text !== "__typename"
    ) {
      return false;
    }

    if (ts.isPropertyDeclaration(member)) {
      return this.isValidTypenamePropertyDeclaration(member, expectedName);
    }
    if (ts.isPropertySignature(member)) {
      return this.isValidTypenamePropertySignature(member, expectedName);
    }

    this.report(
      member.name,
      // TODO: Could show what kind we found, but TS AST does not have node names.
      `Expected \`__typename\` to be a property declaration.`,
    );
    return false;
  }

  isValidTypenamePropertyDeclaration(
    node: ts.PropertyDeclaration,
    expectedName: string,
  ) {
    // If we have a type annotation, we ask that it be a string literal.
    // That means, that if we have one, _and_ it's valid, we're done.
    // Otherwise we fall through to the initializer check.
    if (node.type != null) {
      return this.isValidTypenamePropertyType(node.type, expectedName);
    }
    if (node.initializer == null) {
      this.report(
        node.name,
        `Expected \`__typename\` property to have an initializer or a string literal type. For example: \`__typename = "MyType"\` or \`__typename: "MyType";\`.`,
      );
      return false;
    }

    if (!ts.isStringLiteral(node.initializer)) {
      this.report(
        node.initializer,
        `Expected \`__typename\` property initializer to be a string literal. For example: \`__typename = "MyType"\` or \`__typename: "MyType";\`.`,
      );
      return false;
    }

    if (node.initializer.text !== expectedName) {
      this.report(
        node.initializer,
        `Expected \`__typename\` property initializer to be \`"${expectedName}"\`, found \`"${node.initializer.text}"\`.`,
      );
      return false;
    }
    return true;
  }

  isValidTypenamePropertySignature(
    node: ts.PropertySignature,
    expectedName: string,
  ) {
    if (node.type == null) {
      this.report(
        node,
        `Expected \`__typename\` property signature to specify the typename as a string literal string type. For example \`__typename: "${expectedName}";\``,
      );
      return false;
    }
    return this.isValidTypenamePropertyType(node.type, expectedName);
  }

  isValidTypenamePropertyType(node: ts.TypeNode, expectedName: string) {
    if (!ts.isLiteralTypeNode(node) || !ts.isStringLiteral(node.literal)) {
      this.report(
        node,
        `Expected \`__typename\` property signature to specify the typename as a string literal string type. For example \`__typename: "${expectedName}";\``,
      );
      return false;
    }
    if (node.literal.text !== expectedName) {
      this.report(
        node,
        `Expected \`__typename\` property to be \`"${expectedName}"\``,
      );
      return false;
    }
    return true;
  }

  collectInterfaces(
    node: ts.ClassDeclaration | ts.InterfaceDeclaration,
  ): Array<NamedTypeNode> | null {
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
          this.ctx.markUnresolvedType(type.expression, namedType.name);
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
    node: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeLiteralNode,
  ): Array<FieldDefinitionNode> {
    const fields: FieldDefinitionNode[] = [];
    ts.forEachChild(node, (node) => {
      if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
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
    argsParam: ts.ParameterDeclaration,
  ): ReadonlyArray<InputValueDefinitionNode> | null {
    const args: InputValueDefinitionNode[] = [];

    const argsType = argsParam.type;
    if (argsType == null) {
      return this.report(
        argsParam,
        "Expected GraphQL field arguments to have a TypeScript type. If there are no arguments, you can use `args: never`.",
      );
    }
    if (argsType.kind === ts.SyntaxKind.NeverKeyword) {
      return [];
    }
    if (!ts.isTypeLiteralNode(argsType)) {
      return this.report(
        argsType,
        "Expected GraphQL field arguments to be typed using a literal object: `{someField: string}`.",
      );
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
    } else if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return { kind: Kind.BOOLEAN, loc: this.loc(node), value: true };
    } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return { kind: Kind.BOOLEAN, loc: this.loc(node), value: false };
    } else if (ts.isObjectLiteralExpression(node)) {
      return this.cellectObjectLiteral(node);
    }
    // FIXME: Arrays, etc.
    this.reportUnhandled(
      node,
      "Expected GraphQL field argument default values to be a literal.",
    );
    return null;
  }

  cellectObjectLiteral(
    node: ts.ObjectLiteralExpression,
  ): ConstObjectValueNode | null {
    const fields: ConstObjectFieldNode[] = [];
    let errors = false;
    for (const property of node.properties) {
      const field = this.collectObjectField(property);
      if (field == null) {
        errors = true;
      } else {
        fields.push(field);
      }
    }
    if (errors) {
      return null;
    }
    return {
      kind: Kind.OBJECT,
      loc: this.loc(node),
      fields,
    };
  }

  collectObjectField(
    node: ts.ObjectLiteralElementLike,
  ): ConstObjectFieldNode | null {
    if (!ts.isPropertyAssignment(node)) {
      return this.reportUnhandled(
        node,
        "Expected object literal property to be a property assignment.",
      );
    }
    if (node.name == null) {
      return this.reportUnhandled(
        node,
        "Expected object literal property to have a name.",
      );
    }
    const name = this.expectIdentifier(node.name);
    if (name == null) return null;
    const initialize = node.initializer;
    if (initialize == null) {
      return this.report(
        node,
        "Expected object literal property to have an initializer. For example: `{ offset = 10}`.",
      );
    }

    const value = this.collectConstValue(initialize);
    if (value == null) return null;
    return {
      kind: Kind.OBJECT_FIELD,
      loc: this.loc(node),
      name: this.gqlName(node.name, name.text),
      value,
    };
  }

  collectArg(
    node: ts.TypeElement,
    defaults?: Map<string, ts.Expression> | null,
  ): InputValueDefinitionNode | null {
    if (!ts.isPropertySignature(node)) {
      // TODO: How can I create this error?
      return this.report(
        node,
        "Expected GraphQL field argument type to be a property signature.",
      );
    }
    if (!ts.isIdentifier(node.name)) {
      // TODO: How can I create this error?
      return this.report(
        node.name,
        "Expected GraphQL field argument names to be a literal.",
      );
    }

    if (node.type == null) {
      return this.report(
        node.name,
        "Expected GraphQL field argument to have a type.",
      );
    }
    let type = this.collectType(node.type);
    if (type == null) return null;

    if (node.questionToken) {
      type = this.gqlNullableType(type);
    }

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
      | ts.MethodSignature
      | ts.PropertyDeclaration
      | ts.InterfaceDeclaration
      | ts.PropertySignature
      | ts.EnumDeclaration
      | ts.TypeAliasDeclaration
      | ts.FunctionDeclaration,
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
      return this.report(node, "Expected GraphQL entity to have a name.");
    }
    const id = this.expectIdentifier(node.name);
    if (id == null) return null;
    return this.gqlName(id, id.text);
  }

  methodDeclaration(
    node: ts.MethodDeclaration | ts.MethodSignature,
  ): FieldDefinitionNode | null {
    const tag = this.findTag(node, FIELD_TAG);
    if (tag == null) return null;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      return this.report(node.name, "Expected GraphQL field to have a type.");
    }

    const type = this.collectType(node.type);

    // We already reported an error
    if (type == null) return null;

    let args: readonly InputValueDefinitionNode[] | null = null;
    const argsParam = node.parameters[0];
    if (argsParam != null) {
      args = this.collectArgs(argsParam);
    }

    const description = this.collectDescription(node.name);

    const id = this.expectIdentifier(node.name);
    if (id == null) return null;
    let directives: ConstDirectiveNode[] = [];
    if (id.text !== name.value) {
      directives = [this.methodNameDirective(node.name, id.text)];
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
      return this.report(
        node,
        "Expected TypeScript to be able to resolve this GraphQL entity to a symbol.",
      );
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
      directives = [this.methodNameDirective(node.name, id.text)];
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
      return type;
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
    } else if (node.kind === ts.SyntaxKind.BooleanKeyword) {
      return this.gqlNonNullType(node, this.gqlNamedType(node, "Boolean"));
    } else if (node.kind === ts.SyntaxKind.NumberKeyword) {
      return this.report(
        node,
        `Unexpected number type. GraphQL supports both Int and Float, making \`number\` ambiguous. Instead, import the \`Int\` or \`Float\` type from \`${LIBRARY_IMPORT_NAME}\` and use that.`,
      );
    } else if (ts.isTypeLiteralNode(node)) {
      return this.report(
        node,
        `Unexpected type literal. You may want to define a named GraphQL type elsewhere and reference it here.`,
      );
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
          return this.report(
            node,
            `Expected type reference to have type arguments.`,
          );
        }
        const type = this.collectType(node.typeArguments[0]);
        if (type == null) return null;
        return type;
      }
      case "Array":
      case "Iterator":
      case "ReadonlyArray": {
        if (node.typeArguments == null) {
          return this.report(
            node,
            `Expected type reference to have type arguments.`,
          );
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
        this.ctx.markUnresolvedType(node.typeName, namedType.name);
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
    return this.report(node, "Expected an identifier.");
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
  // that field.
  // https://graphql.org/learn/best-practices/#nullability
  handleErrorBubbling(type: TypeNode) {
    if (this.configOptions.nullableByDefault) {
      return this.gqlNullableType(type);
    }
    return type;
  }

  methodNameDirective(nameNode: ts.Node, name: string): ConstDirectiveNode {
    return this.gqlConstDirective(
      nameNode,
      this.gqlName(nameNode, METHOD_NAME_DIRECTIVE),
      [
        this.gqlConstArgument(
          nameNode,
          this.gqlName(nameNode, METHOD_NAME_ARG),
          this.gqlString(nameNode, name),
        ),
      ],
    );
  }

  exportDirective(
    nameNode: ts.Node,
    filename: string,
    functionName: string,
  ): ConstDirectiveNode {
    return this.gqlConstDirective(
      nameNode,
      this.gqlName(nameNode, EXPORTED_DIRECTIVE),
      [
        this.gqlConstArgument(
          nameNode,
          this.gqlName(nameNode, EXPORTED_FILENAME_ARG),
          this.gqlString(nameNode, filename),
        ),
        this.gqlConstArgument(
          nameNode,
          this.gqlName(nameNode, EXPORTED_FUNCTION_NAME_ARG),
          this.gqlString(nameNode, functionName),
        ),
      ],
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
