import {
  ConstDirectiveNode,
  GraphQLAbstractType,
  GraphQLArgument,
  GraphQLEnumType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isOutputType,
  isScalarType,
  isUnionType,
} from "graphql";
import * as ts from "typescript";
import * as path from "path";
import { resolveRelativePath } from "./gratsRoot";
import { SEMANTIC_NON_NULL_DIRECTIVE } from "./publicDirectives";
import {
  ASSERT_NON_NULL_HELPER,
  createAssertNonNullHelper,
} from "./codegenHelpers";
import { extend, nullThrows } from "./utils/helpers";
import { GratsConfig } from "./gratsConfig.js";
import { naturalCompare } from "./utils/naturalCompare";
import {
  ResolverArgument,
  ResolverDefinition,
  Resolvers,
} from "./resolverSchema";
import TSAstBuilder from "./utils/TSAstBuilder";

const RESOLVER_ARGS: string[] = ["source", "args", "context", "info"];

const F = ts.factory;

// Given a GraphQL SDL, returns the a string of TypeScript code that generates a
// GraphQLSchema implementing that schema.
export function codegen(
  schema: GraphQLSchema,
  resolvers: Resolvers,
  config: GratsConfig,
  destination: string,
): string {
  const codegen = new Codegen(schema, resolvers, config, destination);

  codegen.schemaDeclarationExport();

  return codegen.print();
}

class Codegen {
  ts: TSAstBuilder = new TSAstBuilder();
  _typeNameMappings: Map<string, string> = new Map();
  _helpers: Set<string> = new Set();
  _typeDefinitions: Set<string> = new Set();
  _graphQLImports: Set<string> = new Set();

  constructor(
    public _schema: GraphQLSchema,
    public _resolvers: Resolvers,
    public _config: GratsConfig,
    public _destination: string,
  ) {}

  graphQLImport(name: string): ts.Identifier {
    this._graphQLImports.add(name);
    return F.createIdentifier(name);
  }

  graphQLTypeImport(name: string): ts.TypeReferenceNode {
    this._graphQLImports.add(name);
    return F.createTypeReferenceNode(name);
  }

  schemaDeclarationExport(): void {
    this.ts.functionDeclaration(
      "getSchema",
      [F.createModifier(ts.SyntaxKind.ExportKeyword)],
      this.graphQLTypeImport("GraphQLSchema"),
      this.ts.createBlockWithScope(() => {
        this.ts.addStatement(
          F.createReturnStatement(
            F.createNewExpression(
              this.graphQLImport("GraphQLSchema"),
              [],
              [this.schemaConfig()],
            ),
          ),
        );
      }),
    );
  }

  schemaConfig(): ts.ObjectLiteralExpression {
    return this.ts.objectLiteral([
      this.description(this._schema.description),
      this.query(),
      this.mutation(),
      this.subscription(),
      this.types(),
    ]);
  }

  types(): ts.PropertyAssignment {
    const types = Object.values(this._schema.getTypeMap())
      .filter((type) => {
        return !(
          type.name.startsWith("__") ||
          type.name.startsWith("Introspection") ||
          type.name.startsWith("Schema") ||
          // Built in primitives
          type.name === "String" ||
          type.name === "Int" ||
          type.name === "Float" ||
          type.name === "Boolean" ||
          type.name === "ID"
        );
      })
      .map((type) => this.typeReference(type));
    return F.createPropertyAssignment(
      "types",
      F.createArrayLiteralExpression(types),
    );
  }

  deprecated(
    obj:
      | GraphQLField<unknown, unknown>
      | GraphQLEnumValue
      | GraphQLArgument
      | GraphQLInputField,
  ): ts.PropertyAssignment | null {
    if (!obj.deprecationReason) return null;
    return F.createPropertyAssignment(
      "deprecationReason",
      F.createStringLiteral(obj.deprecationReason),
    );
  }

  description(
    description: string | null | undefined,
  ): ts.PropertyAssignment | null {
    if (!description) return null;
    return F.createPropertyAssignment(
      "description",
      F.createStringLiteral(description),
    );
  }

  query(): ts.PropertyAssignment | null {
    const query = this._schema.getQueryType();
    if (!query) return null;
    return F.createPropertyAssignment("query", this.objectType(query));
  }

  mutation(): ts.PropertyAssignment | null {
    const mutation = this._schema.getMutationType();
    if (!mutation) return null;
    return F.createPropertyAssignment("mutation", this.objectType(mutation));
  }

  subscription(): ts.PropertyAssignment | null {
    const subscription = this._schema.getSubscriptionType();
    if (!subscription) return null;
    return F.createPropertyAssignment(
      "subscription",
      this.objectType(subscription),
    );
  }

  objectType(obj: GraphQLObjectType): ts.Expression {
    const varName = `${obj.name}Type`;
    if (!this._typeDefinitions.has(varName)) {
      this._typeDefinitions.add(varName);

      this.ts.constDeclaration(
        varName,
        F.createNewExpression(
          this.graphQLImport("GraphQLObjectType"),
          [],
          [this.objectTypeConfig(obj)],
        ),
        // We need to explicitly specify the type due to circular references in
        // the definition.
        F.createTypeReferenceNode("GraphQLObjectType"),
      );
    }
    return F.createIdentifier(varName);
  }

  objectTypeConfig(obj: GraphQLObjectType): ts.ObjectLiteralExpression {
    return this.ts.objectLiteral([
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.description(obj.description),
      this.fields(obj, false),
      this.interfaces(obj),
    ]);
  }

  importUserConstruct(
    tsModulePath: string,
    exportName: string | null,
    localName: string,
  ): void {
    const abs = resolveRelativePath(tsModulePath);
    const relative = replaceExt(
      path.relative(path.dirname(this._destination), abs),
      this._config.importModuleSpecifierEnding,
    );
    const modulePath = `./${normalizeRelativePathToPosix(relative)}`;
    if (exportName == null) {
      this.ts.importDefault(modulePath, localName);
    } else {
      this.ts.import(modulePath, [{ name: exportName, as: localName }]);
    }
  }

  isDefaultResolverSignature(
    field: GraphQLField<unknown, unknown>,
    signature: ResolverDefinition,
  ): boolean {
    switch (signature.kind) {
      case "property":
        return signature.name == null || field.name === signature.name;
      case "method":
        if (signature.name != null && field.name !== signature.name) {
          return false;
        }
        if (signature.arguments == null || signature.arguments.length === 0) {
          return true;
        }
        return signature.arguments.every((arg, i) => {
          switch (i) {
            case 0:
              return arg.kind === "argumentsObject";
            // TODO: More?
            default:
              return false;
          }
        });
      case "function":
        return false;
      case "staticMethod":
        return false;
    }
  }

  resolveMethod(
    field: GraphQLField<unknown, unknown>,
    methodName: string,
    parentTypeName: string,
  ): ts.MethodDeclaration | null {
    const signature = this._resolvers.types[parentTypeName][field.name];
    if (this.isDefaultResolverSignature(field, signature)) {
      return null;
    }
    switch (signature.kind) {
      case "property":
        return this.ts.method(
          methodName,
          [this.ts.param("source")],
          [
            F.createReturnStatement(
              F.createPropertyAccessExpression(
                F.createIdentifier("source"),
                F.createIdentifier(signature.name ?? field.name),
              ),
            ),
          ],
        );
      case "method": {
        return this.ts.method(
          methodName,
          extractUsedParams(signature.arguments ?? [], true).map((name) =>
            this.ts.param(name),
          ),
          [
            F.createReturnStatement(
              F.createCallExpression(
                F.createPropertyAccessExpression(
                  F.createIdentifier("source"),
                  F.createIdentifier(signature.name ?? field.name),
                ),
                [],
                (signature.arguments ?? []).map((arg) => {
                  return this.resolverParam(arg);
                }),
              ),
            ),
          ],
        );
      }
      case "function": {
        const resolverName = formatResolverFunctionVarName(
          parentTypeName,
          field.name,
        );
        this.importUserConstruct(
          signature.path,
          signature.exportName,
          resolverName,
        );
        return this.ts.method(
          methodName,
          extractUsedParams(signature.arguments ?? [], true).map((name) =>
            this.ts.param(name),
          ),
          [
            F.createReturnStatement(
              F.createCallExpression(
                F.createIdentifier(resolverName),
                undefined,
                (signature.arguments ?? []).map((arg) => {
                  return this.resolverParam(arg);
                }),
              ),
            ),
          ],
        );
      }
      case "staticMethod": {
        // Note: This name is guaranteed to be unique, but for static methods, it
        // means we import the same class multiple times with multiple names.
        const resolverName = formatResolverFunctionVarName(
          parentTypeName,
          field.name,
        );
        this.importUserConstruct(
          signature.path,
          signature.exportName,
          resolverName,
        );
        return this.ts.method(
          methodName,
          extractUsedParams(signature.arguments ?? [], true).map((name) =>
            this.ts.param(name),
          ),
          [
            F.createReturnStatement(
              F.createCallExpression(
                F.createPropertyAccessExpression(
                  F.createIdentifier(resolverName),
                  F.createIdentifier(signature.name),
                ),
                undefined,
                (signature.arguments ?? []).map((arg) => {
                  return this.resolverParam(arg);
                }),
              ),
            ),
          ],
        );
      }
      default:
        // @ts-expect-error
        throw new Error(`Unexpected resolver kind ${signature.kind}`);
    }
  }
  // Either `args`, `context`, `info`, or a positional argument like
  // `args.someArg`.
  resolverParam(arg: ResolverArgument): ts.Expression {
    switch (arg.kind) {
      case "argumentsObject":
        return F.createIdentifier("args");
      case "context":
        return F.createIdentifier("context");
      case "information":
        return F.createIdentifier("info");
      case "source":
        return F.createIdentifier("source");
      case "named":
        return F.createPropertyAccessExpression(
          F.createIdentifier("args"),
          F.createIdentifier(arg.name),
        );
      default:
        // @ts-expect-error
        throw new Error(`Unexpected resolver kind ${arg.kind}`);
    }
  }

  // If a field is smantically non-null, we need to wrap the resolver in a
  // runtime check to ensure that the resolver does not return null.
  maybeApplySemanticNullRuntimeCheck(
    field: GraphQLField<unknown, unknown>,
    method_: ts.MethodDeclaration | null,
  ): ts.MethodDeclaration | null {
    const semanticNonNull = fieldDirective(field, SEMANTIC_NON_NULL_DIRECTIVE);
    if (semanticNonNull == null) {
      return method_;
    }

    if (!this._helpers.has(ASSERT_NON_NULL_HELPER)) {
      this._helpers.add(ASSERT_NON_NULL_HELPER);
      this.ts.addHelper(createAssertNonNullHelper());
    }

    const method = method_ ?? this.defaultResolverMethod();

    const bodyStatements = method.body?.statements;
    if (bodyStatements == null || bodyStatements.length === 0) {
      throw new Error(`Expected method to have a body`);
    }
    let foundReturn = false;
    const newBodyStatements = bodyStatements.map((statement) => {
      if (ts.isReturnStatement(statement)) {
        foundReturn = true;
        // We need to wrap the return statement in a call to the runtime check
        return F.createReturnStatement(
          F.createCallExpression(
            F.createIdentifier(ASSERT_NON_NULL_HELPER),
            [],
            [nullThrows(statement.expression)],
          ),
        );
      }
      return statement;
    });
    if (!foundReturn) {
      throw new Error(`Expected method to have a return statement`);
    }
    return { ...method, body: F.createBlock(newBodyStatements, true) };
  }

  defaultResolverMethod(): ts.MethodDeclaration {
    return this.ts.method(
      "resolve",
      RESOLVER_ARGS.map((name) => this.ts.param(name)),
      [
        F.createReturnStatement(
          F.createCallExpression(
            this.graphQLImport("defaultFieldResolver"),
            undefined,
            RESOLVER_ARGS.map((name) => F.createIdentifier(name)),
          ),
        ),
      ],
    );
  }

  fields(
    obj: GraphQLObjectType | GraphQLInterfaceType,
    isInterface: boolean,
  ): ts.MethodDeclaration {
    const fields = Object.entries(obj.getFields()).map(([name, field]) => {
      return F.createPropertyAssignment(
        name,
        this.fieldConfig(field, obj.name, isInterface),
      );
    });

    return this.ts.method(
      "fields",
      [],
      [F.createReturnStatement(this.ts.objectLiteral(fields))],
    );
  }

  interfaces(
    obj: GraphQLObjectType | GraphQLInterfaceType,
  ): ts.MethodDeclaration | null {
    const interfaces = obj.getInterfaces();
    if (!interfaces.length) return null;
    return this.ts.method(
      "interfaces",
      [],
      [
        F.createReturnStatement(
          F.createArrayLiteralExpression(
            interfaces.map((i) => this.interfaceType(i)),
          ),
        ),
      ],
    );
  }

  interfaceType(obj: GraphQLInterfaceType): ts.Expression {
    const varName = `${obj.name}Type`;
    if (!this._typeDefinitions.has(varName)) {
      this._typeDefinitions.add(varName);
      this.ts.constDeclaration(
        varName,
        F.createNewExpression(
          this.graphQLImport("GraphQLInterfaceType"),
          [],
          [this.interfaceTypeConfig(obj)],
        ),
        // We need to explicitly specify the type due to circular references in
        // the definition.
        F.createTypeReferenceNode(this.graphQLImport("GraphQLInterfaceType")),
      );
    }
    return F.createIdentifier(varName);
  }

  interfaceTypeConfig(obj: GraphQLInterfaceType): ts.ObjectLiteralExpression {
    this._schema.getPossibleTypes(obj);
    return this.ts.objectLiteral([
      this.description(obj.description),
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.fields(obj, true),
      this.interfaces(obj),
      this.resolveType(obj),
    ]);
  }

  unionType(obj: GraphQLUnionType): ts.Expression {
    const varName = `${obj.name}Type`;
    if (!this._typeDefinitions.has(varName)) {
      this._typeDefinitions.add(varName);
      this.ts.constDeclaration(
        varName,
        F.createNewExpression(
          this.graphQLImport("GraphQLUnionType"),
          [],
          [this.unionTypeConfig(obj)],
        ),
        // We need to explicitly specify the type due to circular references in
        // the definition.
        F.createTypeReferenceNode(this.graphQLImport("GraphQLUnionType")),
      );
    }
    return F.createIdentifier(varName);
  }

  resolveType(obj: GraphQLAbstractType): ts.ShorthandPropertyAssignment | null {
    let needsResolveType = false;
    for (const t of this._schema.getPossibleTypes(obj)) {
      const ast = nullThrows(t.astNode);
      if (ast.hasTypeNameField) {
        continue;
      }

      const exportedMetadata = ast.exported;
      if (exportedMetadata != null) {
        if (!this._typeNameMappings.has(t.name)) {
          const localName = `${t.name}Class`;
          this.importUserConstruct(
            exportedMetadata.tsModulePath,
            exportedMetadata.exportName,
            localName,
          );

          this._typeNameMappings.set(t.name, localName);
        }
        needsResolveType = true;
      }
    }
    if (needsResolveType) {
      return F.createShorthandPropertyAssignment("resolveType");
    }
    // Just use the default resolveType
    return null;
  }

  unionTypeConfig(obj: GraphQLUnionType): ts.ObjectLiteralExpression {
    return this.ts.objectLiteral([
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.description(obj.description),
      this.ts.method(
        "types",
        [],
        [
          F.createReturnStatement(
            F.createArrayLiteralExpression(
              obj.getTypes().map((t) => this.typeReference(t)),
            ),
          ),
        ],
      ),
      this.resolveType(obj),
    ]);
  }

  customScalarType(obj: GraphQLScalarType): ts.Expression {
    const varName = `${obj.name}Type`;
    if (!this._typeDefinitions.has(varName)) {
      this._typeDefinitions.add(varName);
      this.ts.constDeclaration(
        varName,
        F.createNewExpression(
          this.graphQLImport("GraphQLScalarType"),
          [],
          [this.customScalarTypeConfig(obj)],
        ),
        // We need to explicitly specify the type due to circular references in
        // the definition.
        F.createTypeReferenceNode(this.graphQLImport("GraphQLScalarType")),
      );
    }
    return F.createIdentifier(varName);
  }

  customScalarTypeConfig(obj: GraphQLScalarType): ts.ObjectLiteralExpression {
    return this.ts.objectLiteral([
      this.description(obj.description),
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
    ]);
  }

  inputType(obj: GraphQLInputObjectType): ts.Expression {
    const varName = `${obj.name}Type`;
    if (!this._typeDefinitions.has(varName)) {
      this._typeDefinitions.add(varName);
      this.ts.constDeclaration(
        varName,
        F.createNewExpression(
          this.graphQLImport("GraphQLInputObjectType"),
          [],
          [this.inputTypeConfig(obj)],
        ),
        // We need to explicitly specify the type due to circular references in
        // the definition.
        F.createTypeReferenceNode(this.graphQLImport("GraphQLInputObjectType")),
      );
    }
    return F.createIdentifier(varName);
  }

  inputTypeConfig(obj: GraphQLInputObjectType): ts.ObjectLiteralExpression {
    const properties = [
      this.description(obj.description),
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.inputFields(obj),
    ];
    if (obj.isOneOf) {
      properties.push(F.createPropertyAssignment("isOneOf", F.createTrue()));
    }
    return this.ts.objectLiteral(properties);
  }

  inputFields(obj: GraphQLInputObjectType): ts.MethodDeclaration {
    const fields = Object.entries(obj.getFields()).map(([name, field]) => {
      return F.createPropertyAssignment(name, this.inputFieldConfig(field));
    });

    return this.ts.method(
      "fields",
      [],
      [F.createReturnStatement(this.ts.objectLiteral(fields))],
    );
  }

  inputFieldConfig(field: GraphQLInputField): ts.Expression {
    return this.ts.objectLiteral([
      this.description(field.description),
      this.deprecated(field),
      F.createPropertyAssignment("name", F.createStringLiteral(field.name)),
      F.createPropertyAssignment("type", this.typeReference(field.type)),
    ]);
  }

  fieldConfig(
    field: GraphQLField<unknown, unknown>,
    parentTypeName: string,
    isInterface: boolean,
  ): ts.ObjectLiteralExpression {
    const props = [
      this.description(field.description),
      this.deprecated(field),
      F.createPropertyAssignment("name", F.createStringLiteral(field.name)),
      F.createPropertyAssignment("type", this.typeReference(field.type)),
      field.args.length
        ? F.createPropertyAssignment("args", this.argMap(field.args))
        : null,
    ];

    if (!isInterface) {
      extend(props, this.fieldMethods(field, parentTypeName));
    }

    return this.ts.objectLiteral(props);
  }

  fieldMethods(
    field: GraphQLField<unknown, unknown>,
    parentTypeName: string,
  ): Array<ts.ObjectLiteralElementLike | null> {
    // Note: We assume the default name is used here. When custom operation types are supported
    // we'll need to update this.
    if (parentTypeName !== "Subscription") {
      const resolve = this.resolveMethod(field, "resolve", parentTypeName);
      return [this.maybeApplySemanticNullRuntimeCheck(field, resolve)];
    }
    return [
      // TODO: Maybe avoid adding `assertNonNull` for subscription resolvers?
      this.resolveMethod(field, "subscribe", parentTypeName),
      // Identity function (method?)
      this.maybeApplySemanticNullRuntimeCheck(
        field,
        this.ts.method(
          "resolve",
          [this.ts.param("payload")],
          [F.createReturnStatement(F.createIdentifier("payload"))],
        ),
      ),
    ];
  }

  argMap(args: ReadonlyArray<GraphQLArgument>): ts.ObjectLiteralExpression {
    return this.ts.objectLiteral(
      args.map((arg) =>
        F.createPropertyAssignment(arg.name, this.argConfig(arg)),
      ),
    );
  }

  argConfig(arg: GraphQLArgument): ts.Expression {
    return this.ts.objectLiteral([
      this.description(arg.description),
      this.deprecated(arg),
      F.createPropertyAssignment("name", F.createStringLiteral(arg.name)),
      F.createPropertyAssignment("type", this.typeReference(arg.type)),
      // TODO: arg.defaultValue seems to be missing for complex objects
      arg.defaultValue !== undefined
        ? F.createPropertyAssignment(
            "defaultValue",
            this.defaultValue(arg.defaultValue),
          )
        : null,
      // TODO: DefaultValue
      // TODO: Deprecated
    ]);
  }

  enumType(obj: GraphQLEnumType): ts.Expression {
    const varName = `${obj.name}Type`;
    if (!this._typeDefinitions.has(varName)) {
      this._typeDefinitions.add(varName);
      this.ts.constDeclaration(
        varName,
        F.createNewExpression(
          this.graphQLImport("GraphQLEnumType"),
          [],
          [this.enumTypeConfig(obj)],
        ),
        // We need to explicitly specify the type due to circular references in
        // the definition.
        F.createTypeReferenceNode(this.graphQLImport("GraphQLEnumType")),
      );
    }
    return F.createIdentifier(varName);
  }

  enumTypeConfig(obj: GraphQLEnumType): ts.ObjectLiteralExpression {
    return this.ts.objectLiteral([
      this.description(obj.description),
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.enumValues(obj),
    ]);
  }

  enumValues(obj: GraphQLEnumType): ts.PropertyAssignment {
    const values = obj.getValues().map((value) => {
      return F.createPropertyAssignment(value.name, this.enumValue(value));
    });

    return F.createPropertyAssignment("values", this.ts.objectLiteral(values));
  }

  enumValue(obj: GraphQLEnumValue): ts.Expression {
    return this.ts.objectLiteral([
      this.description(obj.description),
      this.deprecated(obj),
      F.createPropertyAssignment("value", F.createStringLiteral(obj.name)),
    ]);
  }

  defaultValue(value: any) {
    switch (typeof value) {
      case "string":
        return F.createStringLiteral(value);
      case "number":
        return F.createNumericLiteral(value);
      case "boolean":
        return value ? F.createTrue() : F.createFalse();
      case "object":
        if (value === null) {
          return F.createNull();
        } else if (Array.isArray(value)) {
          return F.createArrayLiteralExpression(
            value.map((v) => this.defaultValue(v)),
          );
        } else {
          return this.ts.objectLiteral(
            Object.entries(value).map(([k, v]) =>
              F.createPropertyAssignment(k, this.defaultValue(v)),
            ),
          );
        }
      default:
        throw new Error(`TODO: unhandled default value ${value}`);
    }
  }

  typeReference(t: GraphQLOutputType | GraphQLInputType): ts.Expression {
    if (isNonNullType(t)) {
      return F.createNewExpression(
        this.graphQLImport("GraphQLNonNull"),
        [],
        [this.typeReference(t.ofType)],
      );
    } else if (isListType(t)) {
      if (!(isInputType(t.ofType) || isOutputType(t.ofType))) {
        // I think this is just a TS type and TS can't prove that this never happens.
        throw new Error(`TODO: unhandled type ${t}`);
      }
      return F.createNewExpression(
        this.graphQLImport("GraphQLList"),
        [],
        [this.typeReference(t.ofType)],
      );
    } else if (isInterfaceType(t)) {
      return this.interfaceType(t);
    } else if (isObjectType(t)) {
      return this.objectType(t);
    } else if (isUnionType(t)) {
      return this.unionType(t);
    } else if (isInputObjectType(t)) {
      return this.inputType(t);
    } else if (isEnumType(t)) {
      return this.enumType(t);
    } else if (isScalarType(t)) {
      switch (t.name) {
        case "String":
          return this.graphQLImport("GraphQLString");
        case "Int":
          return this.graphQLImport("GraphQLInt");
        case "Float":
          return this.graphQLImport("GraphQLFloat");
        case "Boolean":
          return this.graphQLImport("GraphQLBoolean");
        case "ID":
          return this.graphQLImport("GraphQLID");
        default:
          return this.customScalarType(t);
      }
    } else {
      throw new Error(`TODO: unhandled type ${t}`);
    }
  }

  resolveTypeFunctionDeclaration(): ts.FunctionDeclaration {
    return F.createFunctionDeclaration(
      undefined,
      undefined,
      "resolveType",
      undefined,
      [
        F.createParameterDeclaration(
          undefined,
          undefined,
          "obj",
          undefined,
          F.createTypeReferenceNode("any"),
        ),
      ],
      F.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      F.createBlock(
        [
          F.createIfStatement(
            F.createBinaryExpression(
              F.createTypeOfExpression(
                F.createPropertyAccessExpression(
                  F.createIdentifier("obj"),
                  F.createIdentifier("__typename"),
                ),
              ),
              ts.SyntaxKind.EqualsEqualsEqualsToken,
              F.createStringLiteral("string"),
            ),
            F.createBlock(
              [
                F.createReturnStatement(
                  F.createPropertyAccessExpression(
                    F.createIdentifier("obj"),
                    F.createIdentifier("__typename"),
                  ),
                ),
              ],
              true,
            ),
          ),
          F.createVariableStatement(
            undefined,
            F.createVariableDeclarationList(
              [
                F.createVariableDeclaration(
                  F.createIdentifier("prototype"),
                  undefined,
                  undefined,
                  F.createCallExpression(
                    F.createPropertyAccessExpression(
                      F.createIdentifier("Object"),
                      F.createIdentifier("getPrototypeOf"),
                    ),
                    undefined,
                    [F.createIdentifier("obj")],
                  ),
                ),
              ],
              ts.NodeFlags.Let,
            ),
          ),
          F.createWhileStatement(
            F.createIdentifier("prototype"),
            F.createBlock(
              [
                F.createVariableStatement(
                  undefined,
                  F.createVariableDeclarationList(
                    [
                      F.createVariableDeclaration(
                        F.createIdentifier("name"),
                        undefined,
                        undefined,
                        F.createCallExpression(
                          F.createPropertyAccessExpression(
                            F.createIdentifier("typeNameMap"),
                            F.createIdentifier("get"),
                          ),
                          undefined,
                          [
                            F.createPropertyAccessExpression(
                              F.createIdentifier("prototype"),
                              F.createIdentifier("constructor"),
                            ),
                          ],
                        ),
                      ),
                    ],
                    ts.NodeFlags.Const,
                  ),
                ),
                F.createIfStatement(
                  F.createBinaryExpression(
                    F.createIdentifier("name"),
                    ts.SyntaxKind.ExclamationEqualsToken,
                    F.createNull(),
                  ),
                  F.createBlock(
                    [F.createReturnStatement(F.createIdentifier("name"))],
                    true,
                  ),
                ),
                F.createExpressionStatement(
                  F.createAssignment(
                    F.createIdentifier("prototype"),
                    F.createCallExpression(
                      F.createPropertyAccessExpression(
                        F.createIdentifier("Object"),
                        F.createIdentifier("getPrototypeOf"),
                      ),
                      undefined,
                      [F.createIdentifier("prototype")],
                    ),
                  ),
                ),
              ],
              true,
            ),
          ),
          F.createThrowStatement(
            F.createNewExpression(F.createIdentifier("Error"), undefined, [
              F.createStringLiteral("Cannot find type name."),
            ]),
          ),
        ],
        true,
      ),
    );
  }

  print(): string {
    this.ts.import(
      "graphql",
      [...this._graphQLImports].map((name) => ({ name })),
    );

    if (this._typeNameMappings.size > 0) {
      this.ts.addStatement(
        F.createVariableStatement(
          undefined,
          F.createVariableDeclarationList(
            [
              F.createVariableDeclaration(
                F.createIdentifier("typeNameMap"),
                undefined,
                undefined,
                F.createNewExpression(F.createIdentifier("Map"), undefined, []),
              ),
            ],
            ts.NodeFlags.Const,
          ),
        ),
      );

      const typeNameEntries = Array.from(this._typeNameMappings.entries());
      typeNameEntries.sort(([aTypeName], [bTypeName]) =>
        naturalCompare(aTypeName, bTypeName),
      );

      for (const [typeName, className] of typeNameEntries) {
        this.ts.addStatement(
          F.createExpressionStatement(
            F.createCallExpression(
              F.createPropertyAccessExpression(
                F.createIdentifier("typeNameMap"),
                F.createIdentifier("set"),
              ),
              undefined,
              [F.createIdentifier(className), F.createStringLiteral(typeName)],
            ),
          ),
        );
      }
      this.ts.addStatement(this.resolveTypeFunctionDeclaration());
    }

    return this.ts.print();
  }
}

// Here we try to avoid including unused args.
//
// Unused trailing args are trimmed, unused intermediate args are prefixed with
// an underscore.
function extractUsedParams(
  resolverParams: ResolverArgument[],
  includeSource: boolean = false,
): string[] {
  const wrapperArgs: string[] = [];

  let adding = false;
  for (let i = RESOLVER_ARGS.length - 1; i >= 0; i--) {
    const name = RESOLVER_ARGS[i];
    const used =
      resolverParams.some((param) => {
        return (
          (param.kind === "named" && name === "args") ||
          (param.kind === "argumentsObject" && name === "args") ||
          (param.kind === "context" && name === "context") ||
          (param.kind === "information" && name === "info") ||
          (param.kind === "source" && name === "source")
        );
      }) ||
      (name === "source" && includeSource);

    if (used) {
      adding = true;
    }
    if (!adding) {
      continue;
    }

    wrapperArgs.unshift(used ? name : `_${name}`);
  }
  return wrapperArgs;
}

function fieldDirective(
  field: GraphQLField<unknown, unknown>,
  name: string,
): ConstDirectiveNode | null {
  return field.astNode?.directives?.find((d) => d.name.value === name) ?? null;
}

function replaceExt(filePath: string, newSuffix: string): string {
  const ext = path.extname(filePath);
  return filePath.slice(0, -ext.length) + newSuffix;
}

function formatResolverFunctionVarName(
  parentTypeName: string,
  fieldName: string,
): string {
  const parent = parentTypeName[0].toLowerCase() + parentTypeName.slice(1);
  const field = fieldName[0].toUpperCase() + fieldName.slice(1);
  return `${parent}${field}Resolver`;
}

// https://github.com/sindresorhus/slash/blob/98b618f5a3bfcb5dd374b204868818845b87bb2f/index.js#L8C9-L8C33
function normalizeRelativePathToPosix(unknownPath: string): string {
  return unknownPath.replace(/\\/g, "/");
}
