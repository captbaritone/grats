import {
  ConstDirectiveNode,
  GraphQLField,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
  Kind,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
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
    const maybeProperties = [this.schemaDescription(), this.query()];
    const properties: ts.PropertyAssignment[] = maybeProperties.filter(
      (v): v is ts.PropertyAssignment => v != null,
    );
    return F.createObjectLiteralExpression(properties, true);
  }

  schemaDescription(): ts.PropertyAssignment | null {
    const description = this._schema.description;
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
    const maybeProperties = [
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.fields(obj),
      this.interfaces(obj),
    ];
    const properties: ts.PropertyAssignment[] = maybeProperties.filter(
      (v): v is ts.PropertyAssignment => v != null,
    );
    return F.createObjectLiteralExpression(properties, true);
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
    const fields = {};

    for (const [name, field] of Object.entries(obj.getFields())) {
      fields[name] = this.fieldConfig(field);
    }

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
    const maybeProperties = [
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
      this.fields(obj),
      this.interfaces(obj),
    ];
    const properties: ts.PropertyAssignment[] = maybeProperties.filter(
      (v): v is ts.PropertyAssignment => v != null,
    );
    return F.createObjectLiteralExpression(properties, true);
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
    const maybeProperties = [
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
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
    ];
    const properties: ts.PropertyAssignment[] = maybeProperties.filter(
      (v): v is ts.PropertyAssignment => v != null,
    );
    return F.createObjectLiteralExpression(properties, true);
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
    const maybeProperties = [
      F.createPropertyAssignment("name", F.createStringLiteral(obj.name)),
    ];
    const properties: ts.PropertyAssignment[] = maybeProperties.filter(
      (v): v is ts.PropertyAssignment => v != null,
    );
    return F.createObjectLiteralExpression(properties, true);
  }

  fieldConfig(
    field: GraphQLField<unknown, unknown>,
  ): ts.ObjectLiteralExpression {
    const maybeProperties = [
      F.createPropertyAssignment("name", F.createStringLiteral(field.name)),
      F.createPropertyAssignment("type", this.typeReference(field.type)),
    ];
    const properties: ts.PropertyAssignment[] = maybeProperties.filter(
      (v): v is ts.PropertyAssignment => v != null,
    );
    return F.createObjectLiteralExpression(properties, true);
  }

  typeReference(t: GraphQLOutputType): ts.Expression {
    if (isNonNullType(t)) {
      return F.createNewExpression(
        this.graphQLImport("GraphQLNonNull"),
        [],
        [this.typeReference(t.ofType)],
      );
    } else if (isListType(t)) {
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

  objectLiteral(properties: {
    [name: string]: ts.Expression;
  }): ts.ObjectLiteralExpression {
    return F.createObjectLiteralExpression(
      Object.entries(properties).map(([name, initializer]) =>
        F.createPropertyAssignment(name, initializer),
      ),
      true,
    );
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
