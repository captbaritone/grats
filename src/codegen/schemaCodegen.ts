import {
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
import { extend, nullThrows } from "../utils/helpers";
import { GratsConfig } from "../gratsConfig.js";
import { naturalCompare } from "../utils/naturalCompare";
import TSAstBuilder from "./TSAstBuilder";
import ResolverCodegen from "./resolverCodegen";
import { Resolvers } from "../resolverSchema";

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
  ts: TSAstBuilder;
  resolvers: ResolverCodegen;
  _typeNameMappings: Map<string, string> = new Map();
  _typeDefinitions: Set<string> = new Set();
  _graphQLImports: Set<string> = new Set();

  constructor(
    public _schema: GraphQLSchema,
    _resolvers: Resolvers,
    config: GratsConfig,
    destination: string,
  ) {
    this.ts = new TSAstBuilder(destination, config.importModuleSpecifierEnding);
    this.resolvers = new ResolverCodegen(this.ts, _resolvers);
  }

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
          this.ts.importUserConstruct(
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
      const resolve = this.resolvers.resolveMethod(
        field.name,
        "resolve",
        parentTypeName,
      );
      return [
        this.resolvers.maybeApplySemanticNullRuntimeCheck(
          field,
          resolve,
          "resolve",
        ),
      ];
    }
    return [
      // TODO: Maybe avoid adding `assertNonNull` for subscription resolvers?
      this.resolvers.resolveMethod(field.name, "subscribe", parentTypeName),
      // Identity function (method?)
      this.resolvers.maybeApplySemanticNullRuntimeCheck(
        field,
        this.ts.method(
          "resolve",
          [this.ts.param("payload")],
          [F.createReturnStatement(F.createIdentifier("payload"))],
        ),
        "resolve",
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
