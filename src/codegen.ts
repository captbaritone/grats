import {
  ConstDirectiveNode,
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
import {
  EXPORTED_DIRECTIVE,
  FIELD_NAME_DIRECTIVE,
  ASYNC_ITERABLE_TYPE_DIRECTIVE,
  parseExportedDirective,
  parsePropertyNameDirective,
} from "./metadataDirectives";
import { resolveRelativePath } from "./gratsRoot";

const SCHEMA_CONFIG_TYPE_NAME = "SchemaConfigType";
const SCHEMA_CONFIG_NAME = "config";
const SCHEMA_CONFIG_SCALARS_NAME = "scalars";

const SCALAR_CONFIG_TYPE_NAME = "ScalarConfigType";
const PRIMITIVE_TYPE_NAMES = new Set([
  "String",
  "Int",
  "Float",
  "Boolean",
  "ID",
]);

const F = ts.factory;

// Given a GraphQL SDL, returns the a string of TypeScript code that generates a
// GraphQLSchema implementing that schema.
export function codegen(schema: GraphQLSchema, destination: string): string {
  const codegen = new Codegen(schema, destination);

  codegen.schemaDeclarationExport();

  return codegen.print();
}

class Codegen {
  _schema: GraphQLSchema;
  _destination: string;
  _imports: ts.Statement[] = [];
  _typeDefinitions: Set<string> = new Set();
  _graphQLImports: Set<string> = new Set();
  _statements: ts.Statement[] = [];

  constructor(schema: GraphQLSchema, destination: string) {
    this._schema = schema;
    this._destination = destination;
  }

  createBlockWithScope(closure: () => void): ts.Block {
    const initialStatements = this._statements;
    this._statements = [];
    closure();
    const block = F.createBlock(this._statements, true);
    this._statements = initialStatements;
    return block;
  }

  graphQLImport(name: string): ts.Identifier {
    this._graphQLImports.add(name);
    return F.createIdentifier(name);
  }

  graphQLTypeImport(
    name: string,
    typeArguments?: readonly ts.TypeNode[],
  ): ts.TypeReferenceNode {
    this._graphQLImports.add(name);
    return F.createTypeReferenceNode(name, typeArguments);
  }

  schemaDeclarationExport(): void {
    const schemaConfigType = this.schemaConfigTypeDeclaration();
    const params: ts.ParameterDeclaration[] = [];
    if (schemaConfigType != null) {
      this._statements.push(schemaConfigType);
      params.push(
        F.createParameterDeclaration(
          undefined,
          undefined,
          SCHEMA_CONFIG_NAME,
          undefined,
          F.createTypeReferenceNode(SCHEMA_CONFIG_TYPE_NAME),
        ),
      );
    }
    this.functionDeclaration(
      "getSchema",
      [F.createModifier(ts.SyntaxKind.ExportKeyword)],
      params,
      this.graphQLTypeImport("GraphQLSchema"),
      this.createBlockWithScope(() => {
        this._statements.push(
          F.createReturnStatement(
            F.createNewExpression(
              this.graphQLImport("GraphQLSchema"),
              [],
              [this.schemaConfigObject()],
            ),
          ),
        );
      }),
    );
  }

  schemaConfigTypeDeclaration(): ts.TypeAliasDeclaration | null {
    const configType = this.schemaConfigType();
    if (configType == null) return null;
    return F.createTypeAliasDeclaration(
      [F.createModifier(ts.SyntaxKind.ExportKeyword)],
      SCHEMA_CONFIG_TYPE_NAME,
      undefined,
      configType,
    );
  }

  schemaConfigType(): ts.TypeLiteralNode | null {
    const scalarType = this.schemaConfigScalarType();
    if (scalarType == null) return null;
    return F.createTypeLiteralNode([scalarType]);
  }

  schemaConfigScalarType(): ts.TypeElement | null {
    const typeMap = this._schema.getTypeMap();
    const scalarTypes = Object.values(typeMap)
      .filter(isScalarType)
      .filter((scalar) => {
        // Built in primitives
        return !PRIMITIVE_TYPE_NAMES.has(scalar.name);
      });
    if (scalarTypes.length == 0) return null;
    this._statements.push(this.scalarConfigTypeDeclaration());
    return F.createPropertySignature(
      undefined,
      SCHEMA_CONFIG_SCALARS_NAME,
      undefined,
      F.createTypeLiteralNode(
        scalarTypes.map((scalar) => {
          return F.createPropertySignature(
            undefined,
            scalar.name,
            undefined,
            F.createTypeReferenceNode(SCALAR_CONFIG_TYPE_NAME, [
              F.createTypeReferenceNode(
                formatCustomScalarTypeName(scalar.name),
              ),
            ]),
          );
        }),
      ),
    );
  }

  scalarConfigTypeDeclaration(): ts.TypeAliasDeclaration {
    return F.createTypeAliasDeclaration(
      undefined,
      SCALAR_CONFIG_TYPE_NAME,
      [F.createTypeParameterDeclaration(undefined, "T")],
      F.createTypeLiteralNode([
        F.createMethodSignature(
          undefined,
          "serialize",
          undefined,
          undefined,
          [
            F.createParameterDeclaration(
              undefined,
              undefined,
              "outputValue",
              undefined,
              F.createTypeReferenceNode("T"),
            ),
          ],
          F.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
        ),
        F.createPropertySignature(
          undefined,
          "parseValue",
          undefined,

          this.graphQLTypeImport("GraphQLScalarValueParser", [
            F.createTypeReferenceNode("T"),
          ]),
        ),
        F.createPropertySignature(
          undefined,
          "parseLiteral",
          undefined,
          this.graphQLTypeImport("GraphQLScalarLiteralParser", [
            F.createTypeReferenceNode("T"),
          ]),
        ),
      ]),
    );
  }

  schemaConfigObject(): ts.ObjectLiteralExpression {
    return this.objectLiteral([
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
          PRIMITIVE_TYPE_NAMES.has(type.name)
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
      this.constDeclaration(
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
    return this.objectLiteral([
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.description(obj.description),
      this.fields(obj),
      this.interfaces(obj),
    ]);
  }

  resolveMethod(
    field: GraphQLField<unknown, unknown>,
    methodName: string,
    parentTypeName: string,
  ): ts.MethodDeclaration | null {
    const args = ["source", "args", "context", "info"];

    const exported = fieldDirective(field, EXPORTED_DIRECTIVE);
    if (exported != null) {
      const exportedMetadata = parseExportedDirective(exported);
      const module = exportedMetadata.tsModulePath;
      const funcName = exportedMetadata.exportedFunctionName;
      const argCount = exportedMetadata.argCount;

      const abs = resolveRelativePath(module);
      const relative = stripExt(
        path.relative(path.dirname(this._destination), abs),
      );

      const resolverName = formatResolverFunctionVarName(
        parentTypeName,
        funcName,
      );
      this.import(`./${relative}`, [{ name: funcName, as: resolverName }]);

      const usedArgs = args.slice(0, argCount);

      return this.method(
        methodName,
        usedArgs.map((name) => {
          return this.param(name);
        }),
        [
          F.createReturnStatement(
            F.createCallExpression(
              F.createIdentifier(resolverName),
              undefined,
              usedArgs.map((name) => {
                return F.createIdentifier(name);
              }),
            ),
          ),
        ],
      );
    }
    const propertyName = fieldDirective(field, FIELD_NAME_DIRECTIVE);
    if (propertyName != null) {
      const { name } = parsePropertyNameDirective(propertyName);
      const prop = F.createPropertyAccessExpression(
        F.createIdentifier("source"),
        F.createIdentifier(name),
      );
      const callExpression = F.createCallExpression(
        prop,
        undefined,
        args.map((name) => {
          return F.createIdentifier(name);
        }),
      );

      const isFunc = F.createStrictEquality(
        F.createTypeOfExpression(prop),
        F.createStringLiteral("function"),
      );

      const ternary = F.createConditionalExpression(
        isFunc,
        undefined,
        callExpression,
        undefined,
        prop,
      );
      return this.method(
        methodName,
        args.map((name) => {
          return this.param(name);
        }),
        [F.createReturnStatement(ternary)],
      );
    }

    return null;
  }

  fields(obj: GraphQLObjectType | GraphQLInterfaceType): ts.MethodDeclaration {
    const fields = Object.entries(obj.getFields()).map(([name, field]) => {
      return F.createPropertyAssignment(
        name,
        this.fieldConfig(field, obj.name),
      );
    });

    return this.method(
      "fields",
      [],
      [F.createReturnStatement(this.objectLiteral(fields))],
    );
  }

  interfaces(
    obj: GraphQLObjectType | GraphQLInterfaceType,
  ): ts.MethodDeclaration | null {
    const interfaces = obj.getInterfaces();
    if (!interfaces.length) return null;
    return this.method(
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
      this.constDeclaration(
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
    return this.objectLiteral([
      this.description(obj.description),
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.fields(obj),
      this.interfaces(obj),
    ]);
  }

  unionType(obj: GraphQLUnionType): ts.Expression {
    const varName = `${obj.name}Type`;
    if (!this._typeDefinitions.has(varName)) {
      this._typeDefinitions.add(varName);
      this.constDeclaration(
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

  unionTypeConfig(obj: GraphQLUnionType): ts.ObjectLiteralExpression {
    return this.objectLiteral([
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.description(obj.description),
      this.method(
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
    ]);
  }

  customScalarType(obj: GraphQLScalarType): ts.Expression {
    const varName = `${obj.name}Type`;
    if (!this._typeDefinitions.has(varName)) {
      this._typeDefinitions.add(varName);
      this.constDeclaration(
        varName,
        F.createNewExpression(
          this.graphQLImport("GraphQLScalarType"),
          [F.createTypeReferenceNode(formatCustomScalarTypeName(obj.name))],
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
    const exported = fieldDirective(obj, EXPORTED_DIRECTIVE);
    if (exported != null) {
      const exportedMetadata = parseExportedDirective(exported);
      const module = exportedMetadata.tsModulePath;
      const funcName = exportedMetadata.exportedFunctionName;
      const abs = resolveRelativePath(module);
      const relative = stripExt(
        path.relative(path.dirname(this._destination), abs),
      );

      const scalarTypeName = formatCustomScalarTypeName(obj.name);
      this.import(`./${relative}`, [{ name: funcName, as: scalarTypeName }]);
    }
    return this.objectLiteral([
      this.description(obj.description),
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      ...["serialize", "parseValue", "parseLiteral"].map((name) => {
        let func: ts.Expression = F.createPropertyAccessExpression(
          F.createPropertyAccessExpression(
            F.createPropertyAccessExpression(
              F.createIdentifier(SCHEMA_CONFIG_NAME),
              SCHEMA_CONFIG_SCALARS_NAME,
            ),
            obj.name,
          ),
          name,
        );
        if (name === "serialize") {
          func = F.createAsExpression(
            func,
            this.graphQLTypeImport("GraphQLScalarSerializer", [
              F.createTypeReferenceNode(formatCustomScalarTypeName(obj.name)),
            ]),
          );
        }
        return F.createPropertyAssignment(name, func);
      }),
    ]);
  }

  inputType(obj: GraphQLInputObjectType): ts.Expression {
    const varName = `${obj.name}Type`;
    if (!this._typeDefinitions.has(varName)) {
      this._typeDefinitions.add(varName);
      this.constDeclaration(
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
    return this.objectLiteral([
      this.description(obj.description),
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.inputFields(obj),
    ]);
  }

  inputFields(obj: GraphQLInputObjectType): ts.MethodDeclaration {
    const fields = Object.entries(obj.getFields()).map(([name, field]) => {
      return F.createPropertyAssignment(name, this.inputFieldConfig(field));
    });

    return this.method(
      "fields",
      [],
      [F.createReturnStatement(this.objectLiteral(fields))],
    );
  }

  inputFieldConfig(field: GraphQLInputField): ts.Expression {
    return this.objectLiteral([
      this.description(field.description),
      this.deprecated(field),
      F.createPropertyAssignment("name", F.createStringLiteral(field.name)),
      F.createPropertyAssignment("type", this.typeReference(field.type)),
    ]);
  }

  fieldConfig(
    field: GraphQLField<unknown, unknown>,
    parentTypeName: string,
  ): ts.ObjectLiteralExpression {
    return this.objectLiteral([
      this.description(field.description),
      this.deprecated(field),
      F.createPropertyAssignment("name", F.createStringLiteral(field.name)),
      F.createPropertyAssignment("type", this.typeReference(field.type)),
      field.args.length
        ? F.createPropertyAssignment("args", this.argMap(field.args))
        : null,
      ...this.fieldMethods(field, parentTypeName),
    ]);
  }

  fieldMethods(
    field: GraphQLField<unknown, unknown>,
    parentTypeName: string,
  ): Array<ts.ObjectLiteralElementLike | null> {
    const asyncIterable = fieldDirective(field, ASYNC_ITERABLE_TYPE_DIRECTIVE);
    if (asyncIterable == null) {
      return [this.resolveMethod(field, "resolve", parentTypeName)];
    }
    return [
      this.resolveMethod(field, "subscribe", parentTypeName),
      // Identity function (method?)
      this.method(
        "resolve",
        [this.param("payload")],
        [F.createReturnStatement(F.createIdentifier("payload"))],
      ),
    ];
  }

  argMap(args: ReadonlyArray<GraphQLArgument>): ts.ObjectLiteralExpression {
    return this.objectLiteral(
      args.map((arg) =>
        F.createPropertyAssignment(arg.name, this.argConfig(arg)),
      ),
    );
  }

  argConfig(arg: GraphQLArgument): ts.Expression {
    return this.objectLiteral([
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
      this.constDeclaration(
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
    return this.objectLiteral([
      this.description(obj.description),
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.enumValues(obj),
    ]);
  }

  enumValues(obj: GraphQLEnumType): ts.PropertyAssignment {
    const values = obj.getValues().map((value) => {
      return F.createPropertyAssignment(value.name, this.enumValue(value));
    });

    return F.createPropertyAssignment("values", this.objectLiteral(values));
  }

  enumValue(obj: GraphQLEnumValue): ts.Expression {
    return this.objectLiteral([
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
          return this.objectLiteral(
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

  constDeclaration(
    name: string,
    initializer: ts.Expression,
    type?: ts.TypeNode,
  ): void {
    this._statements.push(
      F.createVariableStatement(
        undefined,
        F.createVariableDeclarationList(
          [
            F.createVariableDeclaration(
              F.createIdentifier(name),
              undefined,
              type,
              initializer,
            ),
          ],
          ts.NodeFlags.Const,
        ),
      ),
    );
  }

  functionDeclaration(
    name: string,
    modifiers: ts.Modifier[] | undefined,
    parameters: ts.ParameterDeclaration[],
    type: ts.TypeNode | undefined,
    body: ts.Block,
  ): void {
    this._statements.push(
      F.createFunctionDeclaration(
        modifiers,
        undefined,
        name,
        undefined,
        parameters,
        type,
        body,
      ),
    );
  }

  // Helper to allow for nullable elements.
  objectLiteral(
    properties: Array<ts.ObjectLiteralElementLike | null>,
  ): ts.ObjectLiteralExpression {
    return F.createObjectLiteralExpression(properties.filter(isNonNull), true);
  }

  // Helper for the common case.
  method(
    name: string,
    params: ts.ParameterDeclaration[],
    statements: ts.Statement[],
  ): ts.MethodDeclaration {
    return F.createMethodDeclaration(
      undefined,
      undefined,
      name,
      undefined,
      undefined,
      params,
      undefined,
      F.createBlock(statements, true),
    );
  }

  // Helper for the common case of a single string argument.
  param(name: string): ts.ParameterDeclaration {
    return F.createParameterDeclaration(
      undefined,
      undefined,
      name,
      undefined,
      undefined,
      undefined,
    );
  }

  import(from: string, names: { name: string; as?: string }[]) {
    const namedImports = names.map((name) => {
      if (name.as) {
        return F.createImportSpecifier(
          false,
          F.createIdentifier(name.name),
          F.createIdentifier(name.as),
        );
      } else {
        return F.createImportSpecifier(
          false,
          undefined,
          F.createIdentifier(name.name),
        );
      }
    });
    this._imports.push(
      F.createImportDeclaration(
        undefined,
        F.createImportClause(
          false,
          undefined,
          F.createNamedImports(namedImports),
        ),
        F.createStringLiteral(from),
      ),
    );
  }

  print(): string {
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const sourceFile = ts.createSourceFile(
      "tempFile.ts",
      "",
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.TS,
    );

    this.import(
      "graphql",
      [...this._graphQLImports].map((name) => ({ name })),
    );

    return printer.printList(
      ts.ListFormat.MultiLine,
      F.createNodeArray([...this._imports, ...this._statements]),
      sourceFile,
    );
  }
}

function fieldDirective(
  field: GraphQLField<unknown, unknown> | GraphQLScalarType,
  name: string,
): ConstDirectiveNode | null {
  return field.astNode?.directives?.find((d) => d.name.value === name) ?? null;
}

function stripExt(filePath: string): string {
  const ext = path.extname(filePath);
  return filePath.slice(0, -ext.length);
}

// Predicate function for filtering out null values
// Includes TypeScript refinement for narrowing the type
function isNonNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

function formatResolverFunctionVarName(
  parentTypeName: string,
  fieldName: string,
): string {
  const parent = parentTypeName[0].toLowerCase() + parentTypeName.slice(1);
  const field = fieldName[0].toUpperCase() + fieldName.slice(1);
  return `${parent}${field}Resolver`;
}

function formatCustomScalarTypeName(scalarName: string): string {
  return `${scalarName}Type`;
}
