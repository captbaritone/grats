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
  ConstListValueNode,
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
import * as E from "./Errors";
import { traverseJSDocTags } from "./utils/JSDoc";

export const LIBRARY_IMPORT_NAME = "grats";
export const LIBRARY_NAME = "Grats";
export const ISSUE_URL = "https://github.com/captbaritone/grats/issues";

export const TYPE_TAG = "gqlType";
export const FIELD_TAG = "gqlField";
export const SCALAR_TAG = "gqlScalar";
export const INTERFACE_TAG = "gqlInterface";
export const ENUM_TAG = "gqlEnum";
export const UNION_TAG = "gqlUnion";
export const INPUT_TAG = "gqlInput";
export const KILLS_PARENT_ON_EXCEPTION_TAG = "killsParentOnException";

export const ALL_TAGS = [
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
    traverseJSDocTags(this.sourceFile, (node, tag) => {
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
            this.reportUnhandled(node, E.fieldTagOnWrongNode());
          }
          break;
        case KILLS_PARENT_ON_EXCEPTION_TAG: {
          const hasFieldTag = ts.getJSDocTags(node).some((t) => {
            return t.tagName.text === FIELD_TAG;
          });
          if (!hasFieldTag) {
            this.report(tag.tagName, E.killsParentOnExceptionOnWrongNode());
          }
          break;
        }
        default:
          {
            const lowerCaseTag = tag.tagName.text.toLowerCase();
            if (lowerCaseTag.startsWith("gql")) {
              for (const t of ALL_TAGS) {
                if (t.toLowerCase() === lowerCaseTag) {
                  this.report(
                    tag.tagName,
                    E.wrongCasingForGratsTag(tag.tagName.text, t),
                  );
                  break;
                }
              }
              this.report(tag.tagName, E.invalidGratsTag(tag.tagName.text));
            }
          }
          break;
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
      this.report(tag, E.invalidTypeTagUsage());
    }
  }

  extractScalar(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isTypeAliasDeclaration(node)) {
      this.scalarTypeAliasDeclaration(node, tag);
    } else {
      this.report(tag, E.invalidScalarTagUsage());
    }
  }

  extractInterface(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isInterfaceDeclaration(node)) {
      this.interfaceInterfaceDeclaration(node, tag);
    } else {
      this.report(tag, E.invalidInterfaceTagUsage());
    }
  }

  extractEnum(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isEnumDeclaration(node)) {
      this.enumEnumDeclaration(node, tag);
    } else if (ts.isTypeAliasDeclaration(node)) {
      this.enumTypeAliasDeclaration(node, tag);
    } else {
      this.report(tag, E.invalidEnumTagUsage());
    }
  }

  extractInput(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isTypeAliasDeclaration(node)) {
      this.inputTypeAliasDeclaration(node, tag);
    } else {
      this.report(tag, E.invalidInputTagUsage());
    }
  }

  extractUnion(node: ts.Node, tag: ts.JSDocTag) {
    if (ts.isTypeAliasDeclaration(node)) {
      this.unionTypeAliasDeclaration(node, tag);
    } else {
      this.report(tag, E.invalidUnionTagUsage());
    }
  }

  /** Error handling and location juggling */

  report(
    node: ts.Node,
    message: string,
    relatedInformation?: ts.DiagnosticRelatedInformation[],
  ): null {
    const start = node.getStart();
    const length = node.getEnd() - start;
    this.errors.push({
      messageText: message,
      file: this.sourceFile,
      code: FAKE_ERROR_CODE,
      category: ts.DiagnosticCategory.Error,
      start,
      length,
      relatedInformation,
    });
    return null;
  }

  // Report an error that we don't know how to infer a type, but it's possible that we should.
  // Gives the user a path forward if they think we should be able to infer this type.
  reportUnhandled(
    node: ts.Node,
    message: string,
    relatedInformation?: ts.DiagnosticRelatedInformation[],
  ): null {
    const suggestion = `If you think ${LIBRARY_NAME} should be able to infer this type, please report an issue at ${ISSUE_URL}.`;
    const completedMessage = `${message}\n\n${suggestion}`;
    return this.report(node, completedMessage, relatedInformation);
  }

  related(node: ts.Node, message: string): ts.DiagnosticRelatedInformation {
    return {
      category: ts.DiagnosticCategory.Message,
      code: 0,
      file: node.getSourceFile(),
      start: node.getStart(),
      length: node.getWidth(),
      messageText: message,
    };
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
      return this.report(node, E.expectedUnionTypeNode());
    }

    const description = this.collectDescription(node.name);

    const types: NamedTypeNode[] = [];
    for (const member of node.type.types) {
      if (!ts.isTypeReferenceNode(member)) {
        return this.reportUnhandled(member, E.expectedUnionTypeReference());
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
      return this.report(funcName, E.invalidParentArgForFunctionField());
    }

    const typeName = this.typeReferenceFromParam(typeParam);
    if (typeName == null) return null;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      return this.report(funcName, E.invalidReturnTypeForFunctionField());
    }

    const type = this.inferMethodType(node);
    if (type == null) return null;

    let args: readonly InputValueDefinitionNode[] | null = null;
    const argsParam = node.parameters[1];
    if (argsParam != null) {
      args = this.collectArgs(argsParam);
    }

    const description = this.collectDescription(funcName);

    if (!ts.isSourceFile(node.parent)) {
      return this.report(node, E.functionFieldNotTopLevel());
    }

    // TODO: Does this work in the browser?
    const filename = this.ctx.getDestFilePath(node.parent);

    const directives = [
      this.exportDirective(funcName, filename, funcName.text),
    ];

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
          type: this.handleErrorBubbling(node, type),
          directives: directives.length === 0 ? undefined : directives,
        },
      ],
    });
  }

  typeReferenceFromParam(typeParam: ts.ParameterDeclaration): NameNode | null {
    if (typeParam.type == null) {
      return this.report(typeParam, E.functionFieldParentTypeMissing());
    }
    if (!ts.isTypeReferenceNode(typeParam.type)) {
      return this.report(typeParam.type, E.functionFieldParentTypeNotValid());
    }

    const nameNode = typeParam.type.typeName;
    const typeName = this.gqlName(nameNode, UNRESOLVED_REFERENCE_NAME);
    this.ctx.markUnresolvedType(nameNode, typeName);
    return typeName;
  }

  namedFunctionExportName(node: ts.FunctionDeclaration): ts.Identifier | null {
    if (node.name == null) {
      return this.report(node, E.functionFieldNotNamed());
    }
    const exportKeyword = node.modifiers?.some((modifier) => {
      return modifier.kind === ts.SyntaxKind.ExportKeyword;
    });
    const defaultKeyword = node.modifiers?.find((modifier) => {
      return modifier.kind === ts.SyntaxKind.DefaultKeyword;
    });

    if (defaultKeyword != null) {
      // TODO: We could support this
      return this.report(defaultKeyword, E.functionFieldDefaultExport());
    }

    if (exportKeyword == null) {
      return this.report(node.name, E.functionFieldNotNamedExport());
    }
    return node.name;
  }

  scalarTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    const description = this.collectDescription(node.name);
    this.ctx.recordTypeName(node.name, name.value);

    // TODO: Assert that this type is unique enough for Grats to infer it distinctly

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

    const deprecatedDirective = this.collectDeprecated(node);

    this.definitions.push({
      kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
      loc: this.loc(node),
      description: description ?? undefined,
      name,
      fields: fields ?? undefined,
      directives:
        deprecatedDirective == null ? undefined : [deprecatedDirective],
    });
  }

  collectInputFields(
    node: ts.TypeAliasDeclaration,
  ): Array<InputValueDefinitionNode> | null {
    const fields: Array<InputValueDefinitionNode> = [];

    if (!ts.isTypeLiteralNode(node.type)) {
      return this.reportUnhandled(node, E.inputTypeNotLiteral());
    }

    for (const member of node.type.members) {
      if (!ts.isPropertySignature(member)) {
        this.reportUnhandled(member, E.inputTypeFieldNotProperty());
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
      return this.report(node, E.inputFieldUntyped());
    }

    const inner = this.inferType(
      node.type ?? node,
      this.ctx.checker.getTypeAtLocation(node),
    );
    if (inner == null) return null;

    const type =
      node.questionToken == null ? inner : this.gqlNullableType(inner);

    const description = this.collectDescription(node.name);

    const deprecatedDirective = this.collectDeprecated(node);

    return {
      kind: Kind.INPUT_VALUE_DEFINITION,
      loc: this.loc(node),
      description: description ?? undefined,
      name: this.gqlName(id, id.text),
      type,
      defaultValue: undefined,
      directives:
        deprecatedDirective == null ? undefined : [deprecatedDirective],
    };
  }

  typeClassDeclaration(node: ts.ClassDeclaration, tag: ts.JSDocTag) {
    if (node.name == null) {
      return this.report(node, E.typeTagOnUnamedClass());
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
      this.reportUnhandled(node.type, E.typeTagOnAliasOfNonObject());
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

    // TODO: Could show what kind we found, but TS AST does not have node names.
    this.report(member.name, E.typeNameNotDeclaration());
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
      this.report(node.name, E.typeNameMissingInitializer());
      return false;
    }

    if (!ts.isStringLiteral(node.initializer)) {
      this.report(node.initializer, E.typeNameInitializeNotString());
      return false;
    }

    if (node.initializer.text !== expectedName) {
      this.report(
        node.initializer,
        E.typeNameInitializerWrong(expectedName, node.initializer.text),
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
      this.report(node, E.typeNameMissingTypeAnnotation(expectedName));
      return false;
    }
    return this.isValidTypenamePropertyType(node.type, expectedName);
  }

  isValidTypenamePropertyType(node: ts.TypeNode, expectedName: string) {
    if (!ts.isLiteralTypeNode(node) || !ts.isStringLiteral(node.literal)) {
      this.report(node, E.typeNameTypeNotStringLiteral(expectedName));
      return false;
    }
    if (node.literal.text !== expectedName) {
      this.report(node, E.typeNameDoesNotMatchExpected(expectedName));
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
      return this.report(argsParam, E.argumentParamIsMissingType());
    }
    if (argsType.kind === ts.SyntaxKind.NeverKeyword) {
      return [];
    }
    if (!ts.isTypeLiteralNode(argsType)) {
      return this.report(argsType, E.argumentParamIsNotObject());
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
    } else if (ts.isArrayLiteralExpression(node)) {
      return this.collectArrayLiteral(node);
    }
    return this.reportUnhandled(node, E.defaultValueIsNotLiteral());
  }

  collectArrayLiteral(
    node: ts.ArrayLiteralExpression,
  ): ConstListValueNode | null {
    const values: ConstValueNode[] = [];
    let errors = false;
    for (const element of node.elements) {
      const value = this.collectConstValue(element);
      if (value == null) {
        errors = true;
      } else {
        values.push(value);
      }
    }
    if (errors) {
      return null;
    }
    return {
      kind: Kind.LIST,
      loc: this.loc(node),
      values,
    };
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
      return this.reportUnhandled(node, E.defaultArgElementIsNotAssignment());
    }
    if (node.name == null) {
      return this.reportUnhandled(node, E.defaultArgPropertyMissingName());
    }
    const name = this.expectIdentifier(node.name);
    if (name == null) return null;
    const initialize = node.initializer;
    if (initialize == null) {
      return this.report(node, E.defaultArgPropertyMissingInitializer());
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
      return this.report(node, E.argIsNotProperty());
    }
    if (!ts.isIdentifier(node.name)) {
      // TODO: How can I create this error?
      return this.report(node.name, E.argNameNotLiteral());
    }

    let type = this.inferType(
      node.type ?? node,
      this.ctx.checker.getTypeAtLocation(node),
    );
    if (type == null) return null;

    if (node.questionToken) {
      /*
      // TODO: Don't allow args that are optional but don't accept null
      if (type.kind === Kind.NON_NULL_TYPE) {
        return this.report(node.questionToken, E.nonNullTypeCannotBeOptional());
      }
      */
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

    const deprecatedDirective = this.collectDeprecated(node);

    return {
      kind: Kind.INPUT_VALUE_DEFINITION,
      loc: this.loc(node),
      description: description || undefined,
      name: this.gqlName(node.name, node.name.text),
      type,
      defaultValue: defaultValue || undefined,
      directives:
        deprecatedDirective != null ? [deprecatedDirective] : undefined,
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

    const values = this.enumTypeAliasVariants(node);
    if (values == null) return;

    const description = this.collectDescription(node.name);
    this.ctx.recordTypeName(node.name, name.value);

    this.definitions.push({
      kind: Kind.ENUM_TYPE_DEFINITION,
      loc: this.loc(node),
      description: description || undefined,
      name,
      values,
    });
  }

  enumTypeAliasVariants(
    node: ts.TypeAliasDeclaration,
  ): EnumValueDefinitionNode[] | null {
    // Semantically we only support deriving enums from type aliases that
    // are unions of string literals. However, in the edge case of a union
    // of one item, there is no way to construct a union type of one item in
    // TypeScript. So, we also support deriving enums from type aliases of a single
    // string literal.
    if (ts.isIntersectionTypeNode(node.type)) {
      if (node.type.types.length !== 2) {
        throw new Error("Invalid intersection type");
      }
      const str: ts.LiteralTypeNode | void = node.type.types.find(
        (t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal),
      );
      const brand = node.type.types.find((t) => ts.isTypeLiteralNode(t));
      if (str == null || brand == null) {
        throw new Error("Invalid intersection type");
      }

      return [
        {
          kind: Kind.ENUM_VALUE_DEFINITION,
          name: this.gqlName(str, str.literal.text),
          description: undefined,
          loc: this.loc(node),
        },
      ];
    }

    if (!ts.isUnionTypeNode(node.type)) {
      this.reportUnhandled(node.type, E.enumTagOnInvalidNode());
      return null;
    }

    const values: EnumValueDefinitionNode[] = [];
    for (const member of node.type.types) {
      // TODO: Complete this feature
      if (ts.isTypeReferenceNode(member)) {
        if (member.typeName.kind === ts.SyntaxKind.Identifier) {
          const symbol = this.ctx.checker.getSymbolAtLocation(member.typeName);
          if (symbol?.declarations?.length === 1) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const declaration = symbol.declarations[0]!;
            if (ts.isTypeAliasDeclaration(declaration)) {
              if (
                ts.isLiteralTypeNode(declaration.type) &&
                ts.isStringLiteral(declaration.type.literal)
              ) {
                const deprecatedDirective = this.collectDeprecated(declaration);
                const memberDescription = this.collectDescription(
                  declaration.name,
                );
                values.push({
                  kind: Kind.ENUM_VALUE_DEFINITION,
                  name: this.gqlName(
                    declaration.type.literal,
                    declaration.type.literal.text,
                  ),
                  directives: deprecatedDirective ? [deprecatedDirective] : [],
                  description: memberDescription || undefined,
                  loc: this.loc(node),
                });
                continue;
              }
            }
          }
        }
      }
      if (
        !ts.isLiteralTypeNode(member) ||
        !ts.isStringLiteral(member.literal)
      ) {
        this.reportUnhandled(member, E.enumVariantNotStringLiteral());
        continue;
      }

      // TODO: Support descriptions on enum members. As it stands, TypeScript
      // does not allow comments attached to string literal types.
      values.push({
        kind: Kind.ENUM_VALUE_DEFINITION,
        name: this.gqlName(member.literal, member.literal.text),
        description: undefined,
        loc: this.loc(member),
      });
    }

    return values;
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
        this.reportUnhandled(member, E.enumVariantMissingInitializer());
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
      return this.report(node, E.gqlEntityMissingName());
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

    const type = this.inferMethodType(node);

    if (type == null) return null;

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
      type: this.handleErrorBubbling(node, type),
      directives: directives.length === 0 ? undefined : directives,
    };
  }

  isTypeAssignableTo(type: ts.Type, assignableTo: ts.Type): boolean {
    return this.ctx.checker.isTypeAssignableTo(type, assignableTo);
  }

  inferType(node: ts.Node, type: ts.Type): TypeNode | null {
    if (type.flags & ts.TypeFlags.Any) {
      return this.reportUnhandled(node, E.couldNotInferGraphQLTypeFromAny());
    }
    if (type.flags & ts.TypeFlags.Never) {
      return this.reportUnhandled(node, E.couldNotInferGraphQLTypeFromNever());
    }
    const nullType = this.ctx.checker.getNullType();
    const undefinedType = this.ctx.checker.getUndefinedType();
    const isOptionalType = (type: ts.Type) => {
      return (
        this.isTypeAssignableTo(nullType, type) ||
        this.isTypeAssignableTo(undefinedType, type)
      );
    };
    const numberType = this.ctx.checker.getNumberType();

    const namedTypes = {
      String: this.ctx.checker.getStringType(),
      Boolean: this.ctx.checker.getBooleanType(),
    };

    const isNullable = isOptionalType(type);
    const nonNullable = this.ctx.checker.getNonNullableType(type);
    const isPlural = this.ctx.checker.isArrayLikeType(nonNullable);

    if (isPlural) {
      const inner = this.ctx.checker.getIndexTypeOfType(
        nonNullable,
        ts.IndexKind.Number,
      );
      if (inner == null) {
        // This probably means we are missing some cases in Grats
        return this.reportUnhandled(
          node,
          E.couldNotInferGraphQLType(this.ctx.checker.typeToString(type)),
        );
      }
      const innerGqlType = this.inferType(node, inner);
      if (innerGqlType == null) return null;
      const gqlType = this.gqlListType(node, innerGqlType);
      return isNullable ? gqlType : this.gqlNonNullType(node, gqlType);
    }

    const symbol = nonNullable.aliasSymbol ?? nonNullable.getSymbol();
    if (symbol != null) {
      const gqlType = this.gqlNamedType(node, UNRESOLVED_REFERENCE_NAME);
      this.ctx.markUnresolvedSymbol(symbol, gqlType.name);
      return isNullable ? gqlType : this.gqlNonNullType(node, gqlType);
    }

    // Catch common errors:
    if (this.isTypeAssignableTo(nonNullable, numberType)) {
      return this.report(node, E.ambiguousNumberType());
    }

    for (const [name, type] of Object.entries(namedTypes)) {
      if (this.isTypeAssignableTo(nonNullable, type)) {
        const gqlType = this.gqlNamedType(node, name);
        return isNullable ? gqlType : this.gqlNonNullType(node, gqlType);
      }
    }

    return this.reportUnhandled(
      node,
      E.couldNotInferGraphQLType(this.ctx.checker.typeToString(type)),
    );
  }

  inferMethodType(
    node: ts.MethodDeclaration | ts.MethodSignature | ts.FunctionDeclaration,
  ): TypeNode | null {
    const signature = this.ctx.checker.getSignatureFromDeclaration(node);
    if (signature == null) {
      throw new Error(
        "Expected to be able to get a signature from a method declaration",
      );
    }
    const returnType = this.ctx.checker.getReturnTypeOfSignature(signature);

    const awaitedType = this.ctx.checker.getAwaitedType(returnType);
    return this.inferType(node.type ?? node.name ?? node, awaitedType);
  }

  inferPropertyType(
    node: ts.PropertyDeclaration | ts.PropertySignature,
  ): TypeNode | null {
    const type = this.ctx.checker.getTypeAtLocation(node);

    const awaitedType = this.ctx.checker.getAwaitedType(type);
    return this.inferType(node.type ?? node.name ?? node, awaitedType);
  }

  collectDescription(node: ts.Node): StringValueNode | null {
    const symbol = this.ctx.checker.getSymbolAtLocation(node);
    if (symbol == null) {
      return this.report(node, E.cannotResolveSymbolForDescription());
    }
    const doc = symbol.getDocumentationComment(this.ctx.checker);
    const description = ts.displayPartsToString(doc);
    if (description) {
      return {
        kind: Kind.STRING,
        loc: this.loc(node),
        value: description,
        block: true,
      };
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
      loc: this.loc(tag.tagName),
      name: this.gqlName(tag.tagName, DEPRECATED_TAG),
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
      this.report(node.name, E.propertyFieldMissingType());
      return null;
    }

    const inner = this.inferPropertyType(node);
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
      type: this.handleErrorBubbling(node, type),
      directives: directives.length === 0 ? undefined : directives,
    };
  }

  /** @deprecated */
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
    return this.report(node, E.expectedIdentifer());
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
  handleErrorBubbling(parentNode: ts.Node, type: TypeNode) {
    const tags = ts.getJSDocTags(parentNode);
    const killsParentOnExceptions = tags.find(
      (tag) => tag.tagName.text === KILLS_PARENT_ON_EXCEPTION_TAG,
    );

    if (killsParentOnExceptions) {
      if (!this.configOptions.nullableByDefault) {
        this.report(
          killsParentOnExceptions.tagName,
          E.killsParentOnExceptionWithWrongConfig(),
        );
      }
      if (type.kind !== Kind.NON_NULL_TYPE) {
        this.report(
          killsParentOnExceptions.tagName,
          E.killsParentOnExceptionOnNullable(),
        );
      }
      return type;
    }

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
