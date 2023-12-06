import {
  ConstDirectiveNode,
  GraphQLArgument,
  GraphQLField,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
  Kind,
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
  EXPORTED_FUNCTION_NAME_ARG,
  METHOD_NAME_ARG,
  METHOD_NAME_DIRECTIVE,
  TS_MODULE_PATH_ARG,
} from "./serverDirectives";
import { resolveRelativePath } from "./gratsRoot";

const F = ts.factory;

// Given a GraphQL SDL, returns the a string of TypeScript code that generates a
// GraphQLSchema implementing that schema.
export function codegen(schema: GraphQLSchema, destination: string): string {
  const codegen = new Codegen(schema, destination);

  codegen.schemaDeclaration();
  codegen.schemaExport();

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

  graphQLImport(name: string): ts.Identifier {
    this._graphQLImports.add(name);
    return F.createIdentifier(name);
  }

  schemaDeclaration(): void {
    this.constDeclaration(
      "schema",
      F.createNewExpression(
        this.graphQLImport("GraphQLSchema"),
        [],
        [this.schemaConfig()],
      ),
    );
  }

  schemaExport(): void {
    this._statements.push(
      F.createExportDeclaration(
        undefined, // [F.createModifier(ts.SyntaxKind.DefaultKeyword)],
        false,
        F.createNamedExports([
          F.createExportSpecifier(
            false,
            undefined,
            F.createIdentifier("schema"),
          ),
        ]),
      ),
    );
  }

  schemaConfig(): ts.ObjectLiteralExpression {
    return this.objectLiteral([
      this.description(this._schema.description),
      this.query(),
      this.mutation(),
      this.subscription(),
    ]);
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

  resolve(field: GraphQLField<unknown, unknown>): ts.MethodDeclaration | null {
    const args = ["source", "args", "context", "info"];

    const exported = fieldDirective(field, EXPORTED_DIRECTIVE);
    if (exported != null) {
      const module = assertDirectiveStringArg(exported, TS_MODULE_PATH_ARG);
      const funcName = assertDirectiveStringArg(
        exported,
        EXPORTED_FUNCTION_NAME_ARG,
      );

      const abs = resolveRelativePath(module);
      const relative = stripExt(
        path.relative(path.dirname(this._destination), abs),
      );
      this.import(`./${relative}`, [funcName]);

      return F.createMethodDeclaration(
        undefined,
        undefined,
        "resolve",
        undefined,
        undefined,
        args.map((name) => {
          return F.createParameterDeclaration(
            undefined,
            undefined,
            name,
            undefined,
            undefined,
            undefined,
          );
        }),
        undefined,
        F.createBlock(
          [
            F.createReturnStatement(
              F.createCallExpression(
                F.createIdentifier(funcName),
                undefined,
                args.map((name) => {
                  return F.createIdentifier(name);
                }),
              ),
            ),
          ],
          true,
        ),
      );
    }
    const propertyName = fieldDirective(field, METHOD_NAME_DIRECTIVE);
    if (propertyName != null) {
      const name = assertDirectiveStringArg(propertyName, METHOD_NAME_ARG);
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
      return F.createMethodDeclaration(
        undefined,
        undefined,
        "resolve",
        undefined,
        undefined,
        args.map((name) => {
          return F.createParameterDeclaration(
            undefined,
            undefined,
            name,
            undefined,
            undefined,
            undefined,
          );
        }),
        undefined,
        F.createBlock([F.createReturnStatement(ternary)], true),
      );
    }

    return null;
  }

  fields(obj: GraphQLObjectType | GraphQLInterfaceType): ts.MethodDeclaration {
    const fields = Object.entries(obj.getFields()).map(([name, field]) => {
      return F.createPropertyAssignment(name, this.fieldConfig(field));
    });

    return F.createMethodDeclaration(
      undefined,
      undefined,
      "fields",
      undefined,
      undefined,
      [],
      undefined,
      F.createBlock(
        [F.createReturnStatement(this.objectLiteral(fields))],
        true,
      ),
    );
  }

  interfaces(
    obj: GraphQLObjectType | GraphQLInterfaceType,
  ): ts.MethodDeclaration | null {
    const interfaces = obj.getInterfaces();
    if (!interfaces.length) return null;
    return F.createMethodDeclaration(
      undefined,
      undefined,
      "interfaces",
      undefined,
      undefined,
      [],
      undefined,
      F.createBlock(
        [
          F.createReturnStatement(
            F.createArrayLiteralExpression(
              interfaces.map((i) => this.interfaceType(i)),
            ),
          ),
        ],
        true,
      ),
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
        F.createTypeReferenceNode(this.graphQLImport("GraphQLInterfaceType")),
      );
    }
    return F.createIdentifier(varName);
  }

  unionTypeConfig(obj: GraphQLUnionType): ts.ObjectLiteralExpression {
    return this.objectLiteral([
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.description(obj.description),
      F.createMethodDeclaration(
        undefined,
        undefined,
        "types",
        undefined,
        undefined,
        [],
        undefined,
        F.createBlock(
          [
            F.createReturnStatement(
              F.createArrayLiteralExpression(
                obj.getTypes().map((t) => this.typeReference(t)),
              ),
            ),
          ],
          true,
        ),
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
    return this.objectLiteral([
      this.description(obj.description),
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
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

    return F.createMethodDeclaration(
      undefined,
      undefined,
      "fields",
      undefined,
      undefined,
      [],
      undefined,
      F.createBlock(
        [F.createReturnStatement(this.objectLiteral(fields))],
        true,
      ),
    );
  }

  inputFieldConfig(field: GraphQLArgument): ts.Expression {
    return this.objectLiteral([
      this.description(field.description),
      F.createPropertyAssignment("name", F.createStringLiteral(field.name)),
      F.createPropertyAssignment("type", this.typeReference(field.type)),
    ]);
  }

  fieldConfig(
    field: GraphQLField<unknown, unknown>,
  ): ts.ObjectLiteralExpression {
    return this.objectLiteral([
      this.description(field.description),
      F.createPropertyAssignment("name", F.createStringLiteral(field.name)),
      F.createPropertyAssignment("type", this.typeReference(field.type)),
      field.args.length
        ? F.createPropertyAssignment("args", this.argMap(field.args))
        : null,
      this.resolve(field),
    ]);
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
      F.createPropertyAssignment("name", F.createStringLiteral(arg.name)),
      F.createPropertyAssignment("type", this.typeReference(arg.type)),
      // TODO: DefaultValue
      // TODO: Description
      // TODO: Deprecated
    ]);
  }

  typeReference(t: GraphQLOutputType | GraphQLInputType): ts.Expression {
    if (isNonNullType(t)) {
      return F.createNewExpression(
        this.graphQLImport("GraphQLNonNull"),
        [],
        [this.typeReference(t.ofType)],
      );
    } else if (isListType(t)) {
      if (!(isInputType(t.ofType) && isOutputType(t.ofType))) {
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

  objectLiteral(
    properties: Array<ts.ObjectLiteralElementLike | null>,
  ): ts.ObjectLiteralExpression {
    return F.createObjectLiteralExpression(properties.filter(isNonNull), true);
  }

  import(from: string, names: string[]): void {
    const namedImports = names.map((name) =>
      F.createImportSpecifier(false, undefined, F.createIdentifier(name)),
    );
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

    this.import("graphql", [...this._graphQLImports]);

    return printer.printList(
      ts.ListFormat.MultiLine,
      F.createNodeArray([...this._imports, ...this._statements]),
      sourceFile,
    );
  }
}

function fieldDirective(
  field: GraphQLField<unknown, unknown>,
  name: string,
): ConstDirectiveNode | null {
  return field.astNode?.directives?.find((d) => d.name.value === name) ?? null;
}

function assertDirectiveStringArg(
  directive: ConstDirectiveNode,
  name: string,
): string {
  const module = directive.arguments?.find((a) => a.name.value === name)?.value;

  if (module?.kind !== Kind.STRING) {
    throw new Error("Expected string argument");
  }

  return module.value;
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
