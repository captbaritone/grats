import {
  GraphQLAbstractType,
  GraphQLArgument,
  GraphQLDirective,
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
  valueFromASTUntyped,
} from "graphql";
import * as ts from "typescript";
import { extend, nullThrows } from "../utils/helpers";
import { GratsConfig } from "../gratsConfig.js";
import { naturalCompare } from "../utils/naturalCompare";
import TSAstBuilder, { JsonValue } from "./TSAstBuilder";
import ResolverCodegen from "./resolverCodegen";
import { Metadata } from "../metadata";
import { ConstDirectiveNode } from "graphql/language";
import { ExportDefinition } from "../GraphQLAstExtensions";

// These directives will be added to the schema by default, so we don't need to
// include them in the generated schema.
const BUILT_IN_DIRECTIVES = new Set([
  "skip",
  "include",
  "deprecated",
  "specifiedBy",
  "oneOf",
]);

const BUILT_IN_SCALARS = new Set(["String", "Int", "Float", "Boolean", "ID"]);
const GQL_SCALAR_TYPE_NAME = "GqlScalar";

const F = ts.factory;

// Given a GraphQL SDL, returns the a string of TypeScript code that generates a
// GraphQLSchema implementing that schema.
export function codegen(
  schema: GraphQLSchema,
  resolvers: Metadata,
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

  constructor(
    public _schema: GraphQLSchema,
    _resolvers: Metadata,
    config: GratsConfig,
    destination: string,
  ) {
    this.ts = new TSAstBuilder(destination, config.importModuleSpecifierEnding);
    this.resolvers = new ResolverCodegen(this.ts, _resolvers);
  }

  graphQLImport(name: string): ts.Identifier {
    this.ts.import("graphql", [{ name, isTypeOnly: false }]);
    return F.createIdentifier(name);
  }

  graphQLTypeImport(name: string): ts.TypeReferenceNode {
    this.ts.import("graphql", [{ name, isTypeOnly: true }]);
    return F.createTypeReferenceNode(name);
  }

  schemaDeclarationExport(): void {
    const scalars = Object.values(this._schema.getTypeMap())
      .filter((type) => {
        return type instanceof GraphQLScalarType;
      })
      .filter((type) => !BUILT_IN_SCALARS.has(type.name))
      .map((type) => {
        this.ts.import("grats", [
          { name: GQL_SCALAR_TYPE_NAME, isTypeOnly: true },
        ]);
        const exported = nullThrows(type.astNode?.exported);

        const localName = `${type.name}Internal`;

        this.ts.importUserConstruct(exported, localName, true);

        return F.createPropertySignature(
          undefined,
          type.name,
          undefined,
          F.createTypeReferenceNode(GQL_SCALAR_TYPE_NAME, [
            F.createTypeReferenceNode(localName),
          ]),
        );
      });

    const params: ts.ParameterDeclaration[] = [];

    if (scalars.length > 0) {
      const scalarConfig = F.createPropertySignature(
        undefined,
        "scalars",
        undefined,
        F.createTypeLiteralNode(scalars),
      );
      this.ts.addStatement(
        F.createTypeAliasDeclaration(
          [F.createModifier(ts.SyntaxKind.ExportKeyword)],
          "SchemaConfig",
          undefined,
          F.createTypeLiteralNode([scalarConfig]),
        ),
      );
      params.push(
        F.createParameterDeclaration(
          undefined,
          undefined,
          "config",
          undefined,
          F.createTypeReferenceNode("SchemaConfig"),
          undefined,
        ),
      );
    }
    this.ts.functionDeclaration(
      "getSchema",
      [F.createModifier(ts.SyntaxKind.ExportKeyword)],
      params,
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
      this.directives(),
      this.query(),
      this.mutation(),
      this.subscription(),
      this.types(),
    ]);
  }

  directives(): ts.PropertyAssignment | null {
    const directives = this._schema.getDirectives().filter((directive) => {
      return !BUILT_IN_DIRECTIVES.has(directive.name);
    });
    if (directives.length === 0) {
      return null;
    }

    const directiveObjs = directives.map((directive) => {
      return F.createNewExpression(
        this.graphQLImport("GraphQLDirective"),
        [],
        [this.directiveConfig(directive)],
      );
    });
    return F.createPropertyAssignment(
      "directives",
      F.createArrayLiteralExpression([
        F.createSpreadElement(this.graphQLImport("specifiedDirectives")),
        ...directiveObjs,
      ]),
    );
  }

  directiveConfig(directive: GraphQLDirective): ts.ObjectLiteralExpression {
    const props: (ts.ObjectLiteralElementLike | null)[] = [
      F.createPropertyAssignment("name", F.createStringLiteral(directive.name)),
      F.createPropertyAssignment(
        "locations",
        F.createArrayLiteralExpression(
          directive.locations.map((location) =>
            F.createPropertyAccessExpression(
              this.graphQLImport("DirectiveLocation"),
              location,
            ),
          ),
        ),
      ),
    ];

    if (directive.description) {
      props.push(this.description(directive.description));
    }

    if (directive.args.length > 0) {
      props.push(
        F.createPropertyAssignment("args", this.argMap(directive.args)),
      );
    }

    if (directive.isRepeatable) {
      props.push(F.createPropertyAssignment("isRepeatable", F.createTrue()));
    }

    return this.ts.objectLiteral(props);
  }

  types(): ts.PropertyAssignment {
    const types = Object.values(this._schema.getTypeMap())
      .filter((type) => {
        return !(
          type.name.startsWith("__") ||
          type.name.startsWith("Introspection") ||
          type.name.startsWith("Schema") ||
          BUILT_IN_SCALARS.has(type.name)
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

      const ast = nullThrows(obj.astNode);

      let typeArguments: ts.TypeNode[] = [];
      if (ast.exported != null) {
        const localType = `T${obj.name}`;
        this.ts.importUserConstruct(ast.exported, localType, true);

        typeArguments = [F.createTypeReferenceNode(localType)];
      }

      this.ts.constDeclaration(
        varName,
        F.createNewExpression(
          this.graphQLImport("GraphQLObjectType"),
          typeArguments,
          [this.objectTypeConfig(obj, ast.exported || null)],
        ),
        // We need to explicitly specify the type due to circular references in
        // the definition.
        F.createTypeReferenceNode("GraphQLObjectType"),
      );
    }
    return F.createIdentifier(varName);
  }

  objectTypeConfig(
    obj: GraphQLObjectType,
    sourceExport: ExportDefinition | null,
  ): ts.ObjectLiteralExpression {
    return this.ts.objectLiteral([
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.description(obj.description),
      this.fields(obj, false, sourceExport),
      this.interfaces(obj),
      this.extensions(obj.astNode?.directives),
    ]);
  }

  fields(
    obj: GraphQLObjectType | GraphQLInterfaceType,
    isInterface: boolean,
    sourceExport: ExportDefinition | null,
  ): ts.MethodDeclaration {
    const fields = Object.entries(obj.getFields()).map(([name, field]) => {
      return F.createPropertyAssignment(
        name,
        this.fieldConfig(field, obj.name, isInterface, sourceExport),
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
          // TODO: Find interface export if exported.
          [this.interfaceTypeConfig(obj, null)],
        ),
        // We need to explicitly specify the type due to circular references in
        // the definition.
        F.createTypeReferenceNode(this.graphQLImport("GraphQLInterfaceType")),
      );
    }
    return F.createIdentifier(varName);
  }

  interfaceTypeConfig(
    obj: GraphQLInterfaceType,
    sourceExport: ExportDefinition | null,
  ): ts.ObjectLiteralExpression {
    this._schema.getPossibleTypes(obj);
    return this.ts.objectLiteral([
      this.description(obj.description),
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.fields(obj, true, sourceExport),
      this.interfaces(obj),
      this.resolveType(obj),
      this.extensions(obj.astNode?.directives),
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
          this.ts.importUserConstruct(exportedMetadata, localName, false);

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
      this.extensions(obj.astNode?.directives),
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
    const scalarConfig = this.ts.propertyAccessChain(
      F.createIdentifier("config"),
      [F.createIdentifier("scalars"), F.createIdentifier(obj.name)],
    );

    return this.ts.objectLiteral([
      this.description(obj.description),
      obj.specifiedByURL
        ? F.createPropertyAssignment(
            "specifiedByURL",
            F.createStringLiteral(obj.specifiedByURL),
          )
        : null,
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.extensions(obj.astNode?.directives),
      F.createSpreadAssignment(scalarConfig),
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
      this.extensions(obj.astNode?.directives),
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
      this.extensions(field.astNode?.directives),
    ]);
  }

  // Creates an `extensions` property containing a `grats` namespace containing
  // information about directives for a given construct. This is needed because
  // `GraphQLSchema` doesn't have a first-party way to represent directives
  // attached to schema constructs.
  extensions(
    directiveNodes: readonly ConstDirectiveNode[] | undefined,
  ): ts.PropertyAssignment | null {
    if (directiveNodes == null) {
      return null;
    }
    const directivesSansBuiltin = directiveNodes.filter((directive) => {
      // These directives have first-class ways of being represented in the
      // `GraphQLSchema` so we omit them from the extensions data.
      return (
        !BUILT_IN_DIRECTIVES.has(directive.name.value) &&
        directive.name.value !== "semanticNonNull"
      );
    });
    if (directivesSansBuiltin.length === 0) {
      return null;
    }

    const directives: JsonValue[] = [];
    for (const directive of directivesSansBuiltin) {
      const directiveArgs: JsonValue = {};
      if (directive.arguments != null) {
        for (const arg of directive.arguments) {
          directiveArgs[arg.name.value] = valueFromASTUntyped(
            arg.value,
          ) as JsonValue;
        }
      }
      directives.push({
        name: directive.name.value,
        args: directiveArgs,
      });
    }

    return F.createPropertyAssignment(
      "extensions",
      this.ts.json({ grats: { directives } }),
    );
  }

  fieldConfig(
    field: GraphQLField<unknown, unknown>,
    parentTypeName: string,
    isInterface: boolean,
    sourceExport: ExportDefinition | null,
  ): ts.ObjectLiteralExpression {
    const props = [
      this.description(field.description),
      this.deprecated(field),
      F.createPropertyAssignment("name", F.createStringLiteral(field.name)),
      F.createPropertyAssignment("type", this.typeReference(field.type)),
      field.args.length
        ? F.createPropertyAssignment("args", this.argMap(field.args))
        : null,
      this.extensions(nullThrows(field.astNode).directives),
    ];

    if (!isInterface) {
      extend(props, this.fieldMethods(field, parentTypeName, sourceExport));
    }

    return this.ts.objectLiteral(props);
  }

  fieldMethods(
    field: GraphQLField<unknown, unknown>,
    parentTypeName: string,
    sourceExport: ExportDefinition | null,
  ): Array<ts.ObjectLiteralElementLike | null> {
    // Note: We assume the default name is used here. When custom operation types are supported
    // we'll need to update this.
    if (parentTypeName !== "Subscription") {
      const resolve = this.resolvers.resolveMethod(
        field.name,
        "resolve",
        parentTypeName,
        sourceExport,
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
      this.resolvers.resolveMethod(
        field.name,
        "subscribe",
        parentTypeName,
        sourceExport,
      ),
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
      F.createPropertyAssignment("type", this.typeReference(arg.type)),
      // TODO: arg.defaultValue seems to be missing for complex objects
      arg.defaultValue !== undefined
        ? F.createPropertyAssignment(
            "defaultValue",
            this.defaultValue(arg.defaultValue),
          )
        : null,
      this.extensions(arg.astNode?.directives),
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
      this.extensions(obj.astNode?.directives),
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
      this.extensions(obj.astNode?.directives),
    ]);
  }

  defaultValue(value: any) {
    return this.ts.json(value);
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
