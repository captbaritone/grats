import {
  FieldDefinitionNode,
  InputValueDefinitionNode,
  Kind,
  NamedTypeNode,
  NameNode,
  TypeNode,
  StringValueNode,
  ConstValueNode,
  ConstDirectiveNode,
  ConstArgumentNode,
  EnumValueDefinitionNode,
  ConstObjectFieldNode,
  ConstObjectValueNode,
  ConstListValueNode,
  assertName,
} from "graphql";
import { tsErr, tsRelated, DiagnosticsResult } from "./utils/DiagnosticError";
import { err, ok } from "./utils/Result";
import * as ts from "typescript";
import { NameDefinition, UNRESOLVED_REFERENCE_NAME } from "./TypeContext";
import * as E from "./Errors";
import { traverseJSDocTags } from "./utils/JSDoc";
import { GraphQLConstructor, GratsDefinitionNode } from "./GraphQLConstructor";
import { relativePath } from "./gratsRoot";
import { ISSUE_URL } from "./Errors";

export const LIBRARY_IMPORT_NAME = "grats";
export const LIBRARY_NAME = "Grats";

export const TYPE_TAG = "gqlType";
export const FIELD_TAG = "gqlField";
export const SCALAR_TAG = "gqlScalar";
export const INTERFACE_TAG = "gqlInterface";
export const ENUM_TAG = "gqlEnum";
export const UNION_TAG = "gqlUnion";
export const INPUT_TAG = "gqlInput";

export const IMPLEMENTS_TAG_DEPRECATED = "gqlImplements";
export const KILLS_PARENT_ON_EXCEPTION_TAG = "killsParentOnException";

// All the tags that start with gql
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
const OPERATION_TYPES = new Set(["Query", "Mutation", "Subscription"]);

type ArgDefaults = Map<string, ts.Expression>;

export type ExtractionSnapshot = {
  readonly definitions: GratsDefinitionNode[];
  readonly unresolvedNames: Map<ts.Node, NameNode>;
  readonly nameDefinitions: Map<ts.Node, NameDefinition>;
  readonly contextReferences: Array<ts.Node>;
  readonly typesWithTypename: Set<string>;
  readonly interfaceDeclarations: Array<ts.InterfaceDeclaration>;
};

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
export function extract(
  sourceFile: ts.SourceFile,
): DiagnosticsResult<ExtractionSnapshot> {
  const extractor = new Extractor();
  return extractor.extract(sourceFile);
}

class Extractor {
  definitions: GratsDefinitionNode[] = [];

  // Snapshot data
  unresolvedNames: Map<ts.Node, NameNode> = new Map();
  nameDefinitions: Map<ts.Node, NameDefinition> = new Map();
  contextReferences: Array<ts.Node> = [];
  typesWithTypename: Set<string> = new Set();
  interfaceDeclarations: Array<ts.InterfaceDeclaration> = [];

  errors: ts.DiagnosticWithLocation[] = [];
  gql: GraphQLConstructor;

  constructor() {
    this.gql = new GraphQLConstructor();
  }

  markUnresolvedType(node: ts.Node, name: NameNode) {
    this.unresolvedNames.set(node, name);
  }

  recordTypeName(
    node: ts.Node,
    name: NameNode,
    kind: NameDefinition["kind"],
  ): void {
    this.nameDefinitions.set(node, { name, kind });
  }

  // Traverse all nodes, checking each one for its JSDoc tags.
  // If we find a tag we recognize, we extract the relevant information,
  // reporting an error if it is attached to a node where that tag is not
  // supported.
  extract(sourceFile: ts.SourceFile): DiagnosticsResult<ExtractionSnapshot> {
    traverseJSDocTags(sourceFile, (node, tag) => {
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
              ts.isParameter(node) ||
              ts.isMethodDeclaration(node) ||
              ts.isPropertyDeclaration(node) ||
              ts.isMethodSignature(node) ||
              ts.isPropertySignature(node)
            )
          ) {
            // Right now this happens via deep traversal
            // Note: Keep this in sync with `collectFields`
            this.reportUnhandled(node, "field", E.fieldTagOnWrongNode());
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
    return ok({
      definitions: this.definitions,
      unresolvedNames: this.unresolvedNames,
      nameDefinitions: this.nameDefinitions,
      contextReferences: this.contextReferences,
      typesWithTypename: this.typesWithTypename,
      interfaceDeclarations: this.interfaceDeclarations,
    });
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
    this.errors.push(tsErr(node, message, relatedInformation));
    return null;
  }

  // Report an error that we don't know how to infer a type, but it's possible that we should.
  // Gives the user a path forward if they think we should be able to infer this type.
  reportUnhandled(
    node: ts.Node,
    positionKind:
      | "type"
      | "field"
      | "field type"
      | "input"
      | "input field"
      | "union member"
      | "constant value"
      | "union"
      | "enum value",
    message: string,
    relatedInformation?: ts.DiagnosticRelatedInformation[],
  ): null {
    const suggestion = `If you think ${LIBRARY_NAME} should be able to infer this ${positionKind}, please report an issue at ${ISSUE_URL}.`;
    const completedMessage = `${message}\n\n${suggestion}`;
    return this.report(node, completedMessage, relatedInformation);
  }

  /** TypeScript traversals */

  unionTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (!ts.isUnionTypeNode(node.type)) {
      return this.report(node, E.expectedUnionTypeNode());
    }

    const description = this.collectDescription(node);

    const types: NamedTypeNode[] = [];
    for (const member of node.type.types) {
      if (!ts.isTypeReferenceNode(member)) {
        return this.reportUnhandled(
          member,
          "union member",
          E.expectedUnionTypeReference(),
        );
      }
      const namedType = this.gql.namedType(
        member.typeName,
        UNRESOLVED_REFERENCE_NAME,
      );
      this.markUnresolvedType(member.typeName, namedType.name);
      types.push(namedType);
    }

    this.recordTypeName(node.name, name, "UNION");

    this.definitions.push(
      this.gql.unionTypeDefinition(node, name, types, description),
    );
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

    const returnType = this.collectReturnType(node.type);
    if (returnType == null) return null;
    const { type, isStream } = returnType;

    let args: readonly InputValueDefinitionNode[] | null = null;
    const argsParam = node.parameters[1];
    if (argsParam != null) {
      args = this.collectArgs(argsParam);
    }

    const context = node.parameters[2];
    if (context != null) {
      this.validateContextParameter(context);
    }

    const description = this.collectDescription(node);

    if (!ts.isSourceFile(node.parent)) {
      return this.report(node, E.functionFieldNotTopLevel());
    }

    // TODO: Does this work in the browser?
    const tsModulePath = relativePath(node.getSourceFile().fileName);

    const directives = [
      this.gql.exportedDirective(funcName, {
        tsModulePath,
        exportedFunctionName: funcName.text,
        argCount: node.parameters.length,
      }),
    ];

    if (isStream) {
      directives.push(this.gql.asyncIterableDirective(node.type));
    }

    const deprecated = this.collectDeprecated(node);
    if (deprecated != null) {
      directives.push(deprecated);
    }

    const killsParentOnExceptionDirective =
      this.killsParentOnExceptionDirective(node);

    if (killsParentOnExceptionDirective != null) {
      directives.push(killsParentOnExceptionDirective);
    }

    const field = this.gql.fieldDefinition(
      node,
      name,
      type,
      args,
      directives,
      description,
    );
    this.definitions.push(
      this.gql.abstractFieldDefinition(node, typeName, field),
    );
  }

  typeReferenceFromParam(typeParam: ts.ParameterDeclaration): NameNode | null {
    if (typeParam.type == null) {
      return this.report(typeParam, E.functionFieldParentTypeMissing());
    }
    if (!ts.isTypeReferenceNode(typeParam.type)) {
      return this.report(typeParam.type, E.functionFieldParentTypeNotValid());
    }

    const nameNode = typeParam.type.typeName;
    const typeName = this.gql.name(nameNode, UNRESOLVED_REFERENCE_NAME);
    this.markUnresolvedType(nameNode, typeName);
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

  typeAliasExportName(node: ts.TypeAliasDeclaration): ts.Identifier | null {
    const exportKeyword = node.modifiers?.some((modifier) => {
      return modifier.kind === ts.SyntaxKind.ExportKeyword;
    });
    if (exportKeyword == null) {
      return this.report(node.name, E.customScalarTypeNotExported());
    }
    return node.name;
  }

  scalarTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    const description = this.collectDescription(node);
    this.recordTypeName(node.name, name, "SCALAR");

    // Ensure the type is exported
    const exportName = this.typeAliasExportName(node);
    if (exportName == null) return null;

    const tsModulePath = relativePath(node.getSourceFile().fileName);

    const directives = [
      this.gql.exportedDirective(exportName, {
        tsModulePath,
        exportedFunctionName: exportName.text,
        argCount: 0,
      }),
    ];

    this.definitions.push(
      this.gql.scalarTypeDefinition(node, name, directives, description),
    );
  }

  inputTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    const description = this.collectDescription(node);
    this.recordTypeName(node.name, name, "INPUT_OBJECT");

    const fields = this.collectInputFields(node);

    const deprecatedDirective = this.collectDeprecated(node);

    this.definitions.push(
      this.gql.inputObjectTypeDefinition(
        node,
        name,
        fields,
        deprecatedDirective == null ? null : [deprecatedDirective],
        description,
      ),
    );
  }

  collectInputFields(
    node: ts.TypeAliasDeclaration,
  ): Array<InputValueDefinitionNode> | null {
    const fields: Array<InputValueDefinitionNode> = [];

    if (!ts.isTypeLiteralNode(node.type)) {
      return this.reportUnhandled(node, "input", E.inputTypeNotLiteral());
    }

    for (const member of node.type.members) {
      if (!ts.isPropertySignature(member)) {
        this.reportUnhandled(
          member,
          "input field",
          E.inputTypeFieldNotProperty(),
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
    const id = this.expectNameIdentifier(node.name);
    if (id == null) return null;

    if (node.type == null) {
      return this.report(node, E.inputFieldUntyped());
    }

    const inner = this.collectType(node.type);
    if (inner == null) return null;

    const type =
      node.questionToken == null ? inner : this.gql.nullableType(inner);

    const description = this.collectDescription(node);

    const deprecatedDirective = this.collectDeprecated(node);

    return this.gql.inputValueDefinition(
      node,
      this.gql.name(id, id.text),
      type,
      deprecatedDirective == null ? null : [deprecatedDirective],
      null,
      description,
    );
  }

  typeClassDeclaration(node: ts.ClassDeclaration, tag: ts.JSDocTag) {
    if (node.name == null) {
      return this.report(node, E.typeTagOnUnnamedClass());
    }

    const name = this.entityName(node, tag);
    if (name == null) return null;

    this.validateOperationTypes(node.name, name.value);

    const description = this.collectDescription(node);
    const fields = this.collectFields(node);
    const interfaces = this.collectInterfaces(node);
    this.recordTypeName(node.name, name, "TYPE");

    this.checkForTypenameProperty(node, name.value);

    this.definitions.push(
      this.gql.objectTypeDefinition(
        node,
        name,
        fields,
        interfaces,
        description,
      ),
    );
  }

  validateOperationTypes(node: ts.Node, name: string) {
    // TODO: If we start supporting defining operation types using
    // non-standard names, we will need to update this logic.
    if (OPERATION_TYPES.has(name)) {
      this.report(node, E.operationTypeNotUnknown());
    }
  }

  typeInterfaceDeclaration(node: ts.InterfaceDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    this.validateOperationTypes(node.name, name.value);

    const description = this.collectDescription(node);
    const fields = this.collectFields(node);
    const interfaces = this.collectInterfaces(node);
    this.recordTypeName(node.name, name, "INTERFACE");

    this.checkForTypenameProperty(node, name.value);

    this.definitions.push(
      this.gql.objectTypeDefinition(
        node,
        name,
        fields,
        interfaces,
        description,
      ),
    );
  }

  typeTypeAliasDeclaration(node: ts.TypeAliasDeclaration, tag: ts.JSDocTag) {
    const name = this.entityName(node, tag);
    if (name == null) return null;

    let fields: FieldDefinitionNode[] = [];
    let interfaces: NamedTypeNode[] | null = null;

    if (ts.isTypeLiteralNode(node.type)) {
      this.validateOperationTypes(node.type, name.value);
      fields = this.collectFields(node.type);
      interfaces = this.collectInterfaces(node);
      this.checkForTypenameProperty(node.type, name.value);
    } else if (node.type.kind === ts.SyntaxKind.UnknownKeyword) {
      // This is fine, we just don't know what it is. This should be the expected
      // case for operation types such as `Query`, `Mutation`, and `Subscription`
      // where there is not strong convention around.
    } else {
      return this.report(node.type, E.typeTagOnAliasOfNonObjectOrUnknown());
    }

    const description = this.collectDescription(node);
    this.recordTypeName(node.name, name, "TYPE");

    this.definitions.push(
      this.gql.objectTypeDefinition(
        node,
        name,
        fields,
        interfaces,
        description,
      ),
    );
  }

  checkForTypenameProperty(
    node: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeLiteralNode,
    expectedName: string,
  ) {
    const hasTypename = node.members.some((member) => {
      return this.isValidTypeNameProperty(member, expectedName);
    });
    if (hasTypename) {
      this.typesWithTypename.add(expectedName);
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
    node:
      | ts.ClassDeclaration
      | ts.InterfaceDeclaration
      | ts.TypeAliasDeclaration,
  ): Array<NamedTypeNode> | null {
    this.reportTagInterfaces(node);

    return ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)
      ? this.collectHeritageInterfaces(node)
      : null;
  }

  reportTagInterfaces(
    node:
      | ts.TypeAliasDeclaration
      | ts.ClassDeclaration
      | ts.InterfaceDeclaration,
  ) {
    const tag = this.findTag(node, IMPLEMENTS_TAG_DEPRECATED);
    if (tag == null) return null;

    if (node.kind === ts.SyntaxKind.ClassDeclaration) {
      this.report(tag, E.implementsTagOnClass());
    }
    if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
      this.report(tag, E.implementsTagOnInterface());
    }
    if (node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
      this.report(tag, E.implementsTagOnTypeAlias());
    }
  }

  collectHeritageInterfaces(
    node: ts.ClassDeclaration | ts.InterfaceDeclaration,
  ): Array<NamedTypeNode> | null {
    if (node.heritageClauses == null) return null;

    const maybeInterfaces: Array<NamedTypeNode | null> = node.heritageClauses
      .filter((clause) => {
        if (node.kind === ts.SyntaxKind.ClassDeclaration) {
          return clause.token === ts.SyntaxKind.ImplementsKeyword;
        }
        // Interfaces can only have extends clauses, and those are allowed.
        return true;
      })
      .flatMap((clause): Array<NamedTypeNode | null> => {
        return clause.types
          .map((type) => type.expression)
          .filter((expression) => ts.isIdentifier(expression))
          .map((expression) => {
            const namedType = this.gql.namedType(
              expression,
              UNRESOLVED_REFERENCE_NAME,
            );
            this.markUnresolvedType(expression, namedType.name);
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

  hasGqlTag(node: ts.Node): boolean {
    return ts.getJSDocTags(node).some((tag) => {
      return ALL_TAGS.includes(tag.tagName.text);
    });
  }

  interfaceInterfaceDeclaration(
    node: ts.InterfaceDeclaration,
    tag: ts.JSDocTag,
  ) {
    const name = this.entityName(node, tag);
    if (name == null || name.value == null) {
      return;
    }

    this.interfaceDeclarations.push(node);

    const description = this.collectDescription(node);
    const interfaces = this.collectInterfaces(node);

    const fields = this.collectFields(node);

    this.recordTypeName(node.name, name, "INTERFACE");

    this.definitions.push(
      this.gql.interfaceTypeDefinition(
        node,
        name,
        fields,
        interfaces,
        description,
      ),
    );
  }

  collectFields(
    node: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeLiteralNode,
  ): Array<FieldDefinitionNode> {
    const fields: FieldDefinitionNode[] = [];
    ts.forEachChild(node, (node) => {
      if (ts.isConstructorDeclaration(node)) {
        // Handle parameter properties
        // https://www.typescriptlang.org/docs/handbook/2/classes.html#parameter-properties
        for (const param of node.parameters) {
          const field = this.constructorParam(param);
          if (field != null) {
            fields.push(field);
          }
        }
      }
      if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
        const field = this.methodDeclaration(node);
        if (field != null) {
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

  constructorParam(node: ts.ParameterDeclaration): FieldDefinitionNode | null {
    const tag = this.findTag(node, FIELD_TAG);
    if (tag == null) return null;
    if (node.modifiers == null) {
      return this.report(node, E.parameterWithoutModifiers());
    }

    const isParameterProperty = node.modifiers.some(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.PublicKeyword ||
        modifier.kind === ts.SyntaxKind.PrivateKeyword ||
        modifier.kind === ts.SyntaxKind.ProtectedKeyword ||
        modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
    );

    if (!isParameterProperty) {
      return this.report(node, E.parameterWithoutModifiers());
    }

    const notPublic = node.modifiers.find(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.PrivateKeyword ||
        modifier.kind === ts.SyntaxKind.ProtectedKeyword,
    );

    if (notPublic != null) {
      return this.report(notPublic, E.parameterPropertyNotPublic());
    }

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      return this.report(node, E.parameterPropertyMissingType());
    }

    const id = node.name;
    if (ts.isArrayBindingPattern(id) || ts.isObjectBindingPattern(id)) {
      // TypeScript triggers an error if a binding pattern is used for a
      // parameter property, so we don't need to report them.
      // https://www.typescriptlang.org/play?#code/MYGwhgzhAEBiD29oG8BQ1rHgOwgFwCcBXYPeAgCgAciAjEAS2BQDNEBfAShXdXaA
      return null;
    }

    let directives: ConstDirectiveNode[] = [];
    if (id.text !== name.value) {
      directives = [
        this.gql.propertyNameDirective(node.name, { name: id.text }),
      ];
    }

    const type = this.collectType(node.type);
    if (type == null) return null;

    const deprecated = this.collectDeprecated(node);
    if (deprecated != null) {
      directives.push(deprecated);
    }
    const description = this.collectDescription(node);

    const killsParentOnExceptionDirective =
      this.killsParentOnExceptionDirective(node);

    if (killsParentOnExceptionDirective != null) {
      directives.push(killsParentOnExceptionDirective);
    }

    return this.gql.fieldDefinition(
      node,
      name,
      type,
      null,
      directives,
      description,
    );
  }

  collectArgs(
    argsParam: ts.ParameterDeclaration,
  ): ReadonlyArray<InputValueDefinitionNode> | null {
    const args: InputValueDefinitionNode[] = [];

    const argsType = argsParam.type;
    if (argsType == null) {
      return this.report(argsParam, E.argumentParamIsMissingType());
    }
    if (argsType.kind === ts.SyntaxKind.UnknownKeyword) {
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
      return this.gql.string(node, node.text);
    } else if (ts.isNumericLiteral(node)) {
      return node.text.includes(".")
        ? this.gql.float(node, node.text)
        : this.gql.int(node, node.text);
    } else if (this.isNullish(node)) {
      return this.gql.null(node);
    } else if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return this.gql.boolean(node, true);
    } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return this.gql.boolean(node, false);
    } else if (ts.isObjectLiteralExpression(node)) {
      return this.collectObjectLiteral(node);
    } else if (ts.isArrayLiteralExpression(node)) {
      return this.collectArrayLiteral(node);
    }
    return this.reportUnhandled(
      node,
      "constant value",
      E.defaultValueIsNotLiteral(),
    );
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
    return this.gql.list(node, values);
  }

  collectObjectLiteral(
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
    return this.gql.object(node, fields);
  }

  collectObjectField(
    node: ts.ObjectLiteralElementLike,
  ): ConstObjectFieldNode | null {
    if (!ts.isPropertyAssignment(node)) {
      return this.reportUnhandled(
        node,
        "constant value",
        E.defaultArgElementIsNotAssignment(),
      );
    }
    if (node.name == null) {
      return this.reportUnhandled(
        node,
        "field",
        E.defaultArgPropertyMissingName(),
      );
    }
    const name = this.expectNameIdentifier(node.name);
    if (name == null) return null;
    const initialize = node.initializer;
    if (initialize == null) {
      return this.report(node, E.defaultArgPropertyMissingInitializer());
    }

    const value = this.collectConstValue(initialize);
    if (value == null) return null;
    return this.gql.constObjectField(
      node,
      this.gql.name(node.name, name.text),
      value,
    );
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

    if (node.type == null) {
      return this.report(node.name, E.argNotTyped());
    }
    let type = this.collectType(node.type);
    if (type == null) return null;

    if (type.kind !== Kind.NON_NULL_TYPE && !node.questionToken) {
      // If a field is passed an argument value, and that argument is not defined in the request,
      // `graphql-js` will not define the argument property. Therefore we must ensure the argument
      // is not just nullable, but optional.
      return this.report(node.name, E.expectedNullableArgumentToBeOptional());
    }

    if (node.questionToken) {
      // Question mark means we can handle the argument being undefined in the
      // object literal, but if we are going to type the GraphQL arg as
      // optional, the code must also be able to handle an explicit null.
      //
      // TODO: This will catch { a?: string } but not { a?: string | undefined }.
      if (type.kind === Kind.NON_NULL_TYPE) {
        return this.report(node.questionToken, E.nonNullTypeCannotBeOptional());
      }
      type = this.gql.nullableType(type);
    }

    const description = this.collectDescription(node);

    let defaultValue: ConstValueNode | null = null;
    if (defaults != null) {
      const def = defaults.get(node.name.text);
      if (def != null) {
        defaultValue = this.collectConstValue(def);
      }
    }

    const deprecatedDirective = this.collectDeprecated(node);

    return this.gql.inputValueDefinition(
      node,
      this.gql.name(node.name, node.name.text),
      type,
      deprecatedDirective == null ? null : [deprecatedDirective],
      defaultValue,
      description,
    );
  }

  enumEnumDeclaration(node: ts.EnumDeclaration, tag: ts.JSDocTag): void {
    const name = this.entityName(node, tag);
    if (name == null || name.value == null) {
      return;
    }
    const description = this.collectDescription(node);

    const values = this.collectEnumValues(node);

    this.recordTypeName(node.name, name, "ENUM");

    this.definitions.push(
      this.gql.enumTypeDefinition(node, name, values, description),
    );
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

    const description = this.collectDescription(node);
    this.recordTypeName(node.name, name, "ENUM");

    this.definitions.push(
      this.gql.enumTypeDefinition(node, name, values, description),
    );
  }

  enumTypeAliasVariants(
    node: ts.TypeAliasDeclaration,
  ): EnumValueDefinitionNode[] | null {
    // Semantically we only support deriving enums from type aliases that
    // are unions of string literals. However, in the edge case of a union
    // of one item, there is no way to construct a union type of one item in
    // TypeScript. So, we also support deriving enums from type aliases of a single
    // string literal.
    if (
      ts.isLiteralTypeNode(node.type) &&
      ts.isStringLiteral(node.type.literal)
    ) {
      return [
        this.gql.enumValueDefinition(
          node,
          this.gql.name(node.type.literal, node.type.literal.text),
          undefined,
          null,
        ),
      ];
    }

    if (!ts.isUnionTypeNode(node.type)) {
      this.reportUnhandled(node.type, "union", E.enumTagOnInvalidNode());
      return null;
    }

    const values: EnumValueDefinitionNode[] = [];
    for (const member of node.type.types) {
      if (
        !ts.isLiteralTypeNode(member) ||
        !ts.isStringLiteral(member.literal)
      ) {
        this.reportUnhandled(
          member,
          "union member",
          E.enumVariantNotStringLiteral(),
        );
        continue;
      }

      // TODO: Support descriptions on enum members. As it stands, TypeScript
      // does not allow comments attached to string literal types.
      values.push(
        this.gql.enumValueDefinition(
          node,
          this.gql.name(member.literal, member.literal.text),
          undefined,
          null,
        ),
      );
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
        this.reportUnhandled(
          member,
          "enum value",
          E.enumVariantMissingInitializer(),
        );
        continue;
      }

      const description = this.collectDescription(member);
      const deprecated = this.collectDeprecated(member);
      values.push(
        this.gql.enumValueDefinition(
          member,
          this.gql.name(member.initializer, member.initializer.text),
          deprecated ? [deprecated] : undefined,
          description,
        ),
      );
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
      | ts.FunctionDeclaration
      | ts.ParameterDeclaration,
    tag: ts.JSDocTag,
  ) {
    if (tag.comment != null) {
      const commentName = ts.getTextOfJSDocComment(tag.comment);
      if (commentName != null) {
        // FIXME: Use the _value_'s location not the tag's
        const locNode = tag;

        // Test for leading newlines using the raw text
        const hasLeadingNewlines = /\n/.test(
          trimTrailingCommentLines(tag.getText()),
        );
        const hasInternalWhitespace = /\s/.test(commentName);
        const validationMessage = graphQLNameValidationMessage(commentName);

        if (hasLeadingNewlines && validationMessage == null) {
          // TODO: Offer quick fix.
          return this.report(
            locNode,
            E.graphQLNameHasLeadingNewlines(commentName, tag.tagName.text),
          );
        }

        if (hasLeadingNewlines || hasInternalWhitespace) {
          return this.report(
            locNode,
            E.graphQLTagNameHasWhitespace(tag.tagName.text),
          );
        }

        // No whitespace, but still invalid. We will assume they meant this to
        // be a GraphQL name but didn't provide a valid identifier.
        //
        // NOTE: We can't let GraphQL validation handle this, because it throws rather
        // than returning a validation message. Presumably because it expects token
        // validation to be done during lexing/parsing.
        if (validationMessage !== null) {
          return this.report(locNode, validationMessage);
        }
        return this.gql.name(locNode, commentName);
      }
    }

    if (node.name == null) {
      return this.report(node, E.gqlEntityMissingName());
    }
    const id = this.expectNameIdentifier(node.name);
    if (id == null) return null;
    return this.gql.name(id, id.text);
  }

  // Ensure the type of the ctx param resolves to the declaration
  // annotated with `@gqlContext`.
  validateContextParameter(node: ts.ParameterDeclaration) {
    if (node.type == null) {
      return this.report(node, E.expectedTypeAnnotationOnContext());
    }

    if (node.type.kind === ts.SyntaxKind.UnknownKeyword) {
      // If the user just needs to define the argument to get to a later parameter,
      // they can use `ctx: unknown` to safely avoid triggering a Grats error.
      return;
    }

    if (!ts.isTypeReferenceNode(node.type)) {
      return this.report(
        node.type,
        E.expectedTypeAnnotationOfReferenceOnContext(),
      );
    }

    // Check for ...
    if (node.dotDotDotToken != null) {
      return this.report(
        node.dotDotDotToken,
        E.unexpectedParamSpreadForContextParam(),
      );
    }

    this.contextReferences.push(node.type.typeName);
  }

  methodDeclaration(
    node: ts.MethodDeclaration | ts.MethodSignature,
  ): FieldDefinitionNode | null {
    const tag = this.findTag(node, FIELD_TAG);
    if (tag == null) return null;

    const name = this.entityName(node, tag);
    if (name == null) return null;

    if (node.type == null) {
      return this.report(node.name, E.methodMissingType());
    }

    const returnType = this.collectReturnType(node.type);
    if (returnType == null) return null;
    const { type, isStream } = returnType;

    // We already reported an error
    if (type == null) return null;

    let args: readonly InputValueDefinitionNode[] | null = null;
    const argsParam = node.parameters[0];
    if (argsParam != null) {
      args = this.collectArgs(argsParam);
    }

    const context = node.parameters[1];
    if (context != null) {
      this.validateContextParameter(context);
    }

    const description = this.collectDescription(node);

    const id = this.expectNameIdentifier(node.name);
    if (id == null) return null;
    let directives: ConstDirectiveNode[] = [];
    if (id.text !== name.value) {
      directives = [
        this.gql.propertyNameDirective(node.name, { name: id.text }),
      ];
    }
    if (isStream) {
      directives.push(this.gql.asyncIterableDirective(node.type));
    }

    const deprecated = this.collectDeprecated(node);
    if (deprecated != null) {
      directives.push(deprecated);
    }

    const killsParentOnExceptionDirective =
      this.killsParentOnExceptionDirective(node);

    if (killsParentOnExceptionDirective != null) {
      directives.push(killsParentOnExceptionDirective);
    }

    return this.gql.fieldDefinition(
      node,
      name,
      type,
      args,
      directives,
      description,
    );
  }

  collectReturnType(
    node: ts.TypeNode,
  ): { type: TypeNode; isStream: boolean } | null {
    if (ts.isTypeReferenceNode(node)) {
      const identifier = this.expectNameIdentifier(node.typeName);
      if (identifier == null) return null;
      if (identifier.text == "AsyncIterable") {
        if (node.typeArguments == null || node.typeArguments.length === 0) {
          // TODO: Better error?
          return this.report(node, E.wrapperMissingTypeArg());
        }
        const t = this.collectType(node.typeArguments[0]);
        if (t == null) return null;
        return { type: t, isStream: true };
      }
    }
    const inner = this.maybeUnwrapPromise(node);
    if (inner == null) return null;
    const t = this.collectType(inner);
    if (t == null) return null;
    return { type: t, isStream: false };
  }

  collectPropertyType(node: ts.TypeNode): TypeNode | null {
    // TODO: Handle function types here.
    const inner = this.maybeUnwrapPromise(node);
    if (inner == null) return null;
    return this.collectType(inner);
  }

  maybeUnwrapPromise(node: ts.TypeNode): ts.TypeNode | null {
    if (ts.isTypeReferenceNode(node)) {
      const identifier = this.expectNameIdentifier(node.typeName);
      if (identifier == null) return null;

      if (identifier.text === "Promise") {
        if (node.typeArguments == null || node.typeArguments.length === 0) {
          return this.report(node, E.wrapperMissingTypeArg());
        }
        return node.typeArguments[0];
      }
    }
    return node;
  }

  collectDescription(node: ts.Node): StringValueNode | null {
    const docs: readonly (ts.JSDoc | ts.JSDocTag)[] =
      // @ts-ignore Exposed as stable in https://github.com/microsoft/TypeScript/pull/53627
      ts.getJSDocCommentsAndTags(node);

    const comment = docs
      .filter((doc) => doc.kind === ts.SyntaxKind.JSDoc)
      .map((doc) => doc.comment)
      .join("");

    if (comment) {
      return this.gql.string(node, comment.trim(), true);
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
        reason = this.gql.constArgument(
          tag,
          this.gql.name(tag, "reason"),
          this.gql.string(tag, reasonComment),
        );
      }
    }

    return this.gql.constDirective(
      tag.tagName,
      this.gql.name(node, DEPRECATED_TAG),
      reason == null ? null : [reason],
    );
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

    const inner = this.collectPropertyType(node.type);
    // We already reported an error
    if (inner == null) return null;
    const type =
      node.questionToken == null ? inner : this.gql.nullableType(inner);

    const description = this.collectDescription(node);

    let directives: ConstDirectiveNode[] = [];
    const id = this.expectNameIdentifier(node.name);
    if (id == null) return null;

    const deprecated = this.collectDeprecated(node);
    if (deprecated != null) {
      directives.push(deprecated);
    }

    if (id.text !== name.value) {
      directives = [
        this.gql.propertyNameDirective(node.name, { name: id.text }),
      ];
    }

    const killsParentOnExceptionDirective =
      this.killsParentOnExceptionDirective(node);

    if (killsParentOnExceptionDirective != null) {
      directives.push(killsParentOnExceptionDirective);
    }

    return this.gql.fieldDefinition(
      node,
      name,
      type,
      null,
      directives,
      description,
    );
  }

  // TODO: Support separate modes for input and output types
  // For input nodes and field may only be optional if `null` is a valid value.
  collectType(node: ts.TypeNode): TypeNode | null {
    if (ts.isTypeReferenceNode(node)) {
      const type = this.typeReference(node);
      if (type == null) return null;
      return type;
    } else if (ts.isArrayTypeNode(node)) {
      const element = this.collectType(node.elementType);
      if (element == null) return null;
      return this.gql.nonNullType(node, this.gql.listType(node, element));
    } else if (ts.isUnionTypeNode(node)) {
      const types = node.types.filter((type) => !this.isNullish(type));
      if (types.length === 0) {
        return this.report(node, E.expectedOneNonNullishType());
      }

      const type = this.collectType(types[0]);
      if (type == null) return null;

      if (types.length > 1) {
        const [first, ...rest] = types;
        // FIXME: If each of `rest` matches `first` this should be okay.
        const incompatibleVariants = rest.map((tsType) => {
          return tsRelated(tsType, "Other non-nullish type");
        });
        this.report(first, E.expectedOneNonNullishType(), incompatibleVariants);
        return null;
      }
      if (node.types.length > 1) {
        return this.gql.nullableType(type);
      }
      return this.gql.nonNullType(node, type);
    } else if (ts.isParenthesizedTypeNode(node)) {
      return this.collectType(node.type);
    } else if (node.kind === ts.SyntaxKind.StringKeyword) {
      return this.gql.nonNullType(node, this.gql.namedType(node, "String"));
    } else if (node.kind === ts.SyntaxKind.BooleanKeyword) {
      return this.gql.nonNullType(node, this.gql.namedType(node, "Boolean"));
    } else if (node.kind === ts.SyntaxKind.NumberKeyword) {
      return this.report(node, E.ambiguousNumberType());
    } else if (ts.isTypeLiteralNode(node)) {
      return this.report(node, E.unsupportedTypeLiteral());
    }
    // TODO: Better error message. This is okay if it's a type reference, but everything else is not.
    this.reportUnhandled(node, "type", E.unknownGraphQLType());
    return null;
  }

  typeReference(node: ts.TypeReferenceNode): TypeNode | null {
    const identifier = this.expectNameIdentifier(node.typeName);
    if (identifier == null) return null;

    const typeName = identifier.text;
    switch (typeName) {
      case "Array":
      case "Iterator":
      case "ReadonlyArray": {
        if (node.typeArguments == null) {
          return this.report(node, E.pluralTypeMissingParameter());
        }
        const element = this.collectType(node.typeArguments[0]);
        if (element == null) return null;
        return this.gql.nonNullType(node, this.gql.listType(node, element));
      }
      default: {
        // We may not have encountered the definition of this type yet. So, we
        // mark it as unresolved and return a placeholder type.
        //
        // A later pass will resolve the type.
        const namedType = this.gql.namedType(node, UNRESOLVED_REFERENCE_NAME);
        this.markUnresolvedType(node.typeName, namedType.name);
        return this.gql.nonNullType(node, namedType);
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

  expectNameIdentifier(node: ts.Node): ts.Identifier | null {
    if (ts.isIdentifier(node)) {
      return node;
    }
    return this.report(node, E.expectedNameIdentifier());
  }

  findTag(node: ts.Node, tagName: string): ts.JSDocTag | null {
    const tags = ts
      .getJSDocTags(node)
      .filter((tag) => tag.tagName.escapedText === tagName);

    if (tags.length === 0) {
      return null;
    }
    if (tags.length > 1) {
      const additionalTags = tags.slice(1).map((tag) => {
        return tsRelated(tag, "Additional tag");
      });

      return this.report(tags[0], E.duplicateTag(tagName), additionalTags);
    }
    return tags[0];
  }

  // It is a GraphQL best practice to model all fields as nullable. This allows
  // the server to handle field level executions by simply returning null for
  // that field.
  // https://graphql.org/learn/best-practices/#nullability
  killsParentOnExceptionDirective(
    parentNode: ts.Node,
  ): ConstDirectiveNode | null {
    const tags = ts.getJSDocTags(parentNode);
    const killsParentOnExceptions = tags.find(
      (tag) => tag.tagName.text === KILLS_PARENT_ON_EXCEPTION_TAG,
    );
    if (killsParentOnExceptions) {
      return this.gql.killsParentOnExceptionDirective(
        killsParentOnExceptions.tagName,
      );
    }
    return null;
  }
}

function graphQLNameValidationMessage(name: string): string | null {
  try {
    assertName(name);
    return null;
  } catch (e) {
    return e.message;
  }
}

// Trims any number of whitespace-only lines including any lines that simply
// contain a `*` surrounded by whitespace.
function trimTrailingCommentLines(text: string) {
  return text.replace(/(\s*\n\s*\*?\s*)+$/, "");
}
