import { DocumentNode } from "graphql";
import * as ts from "typescript";
import * as path from "path";
import { ConfigOptions } from "./gratsConfig";

const F = ts.factory;

// Given a GraphQL SDL, returns the a string of TypeScript code that generates a
// GraphQLSchema implementing that schema.
export function queryCodegen(
  gratsOptions: ConfigOptions,
  configPath: string,
  dest: string,
  doc: DocumentNode,
): string {
  const schemaLocation = path.resolve(
    path.dirname(configPath),
    gratsOptions.tsSchema,
  );
  const codegen = new QueryCodegen(schemaLocation, dest);

  codegen.gen(doc);

  return codegen.print();
}

class QueryCodegen {
  _schemaLocation: string;
  _imports: ts.Statement[] = [];
  _typeDefinitions: Set<string> = new Set();
  _graphQLImports: Set<string> = new Set();
  _statements: ts.Statement[] = [];

  constructor(schemaLocation: string, destination: string) {
    this._schemaLocation = path.relative(
      path.dirname(destination),
      schemaLocation,
    );
  }

  gen(doc: DocumentNode) {
    this.import(makeImport(this._schemaLocation), [{ name: "getSchema" }]);

    // TODO: Should every query create its own schema instance?
    this._statements.push(
      F.createVariableStatement(
        undefined,
        F.createVariableDeclarationList(
          [
            F.createVariableDeclaration(
              "schema",
              undefined,
              undefined,
              F.createCallExpression(
                F.createIdentifier("getSchema"),
                undefined,
                [],
              ),
            ),
          ],
          ts.NodeFlags.Const,
        ),
      ),
    );
    this._statements.push(
      F.createVariableStatement(
        undefined,
        F.createVariableDeclarationList(
          [
            F.createVariableDeclaration(
              "doc",
              undefined,
              F.createTypeReferenceNode(this.graphQLImport("DocumentNode")),
              F.createAsExpression(
                jsonAbleToAst(doc),
                F.createTypeReferenceNode(this.graphQLImport("DocumentNode")),
              ),
            ),
          ],
          ts.NodeFlags.Const,
        ),
      ),
    );
    this._statements.push(
      F.createFunctionDeclaration(
        [F.createModifier(ts.SyntaxKind.ExportKeyword)],
        undefined,
        "executeOperation",
        undefined,
        [
          F.createParameterDeclaration(
            undefined,
            undefined,
            "variables",
            undefined,
            F.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
            undefined,
          ),
        ],
        undefined,
        F.createBlock(
          [
            F.createReturnStatement(
              F.createCallExpression(this.graphQLImport("execute"), undefined, [
                F.createObjectLiteralExpression([
                  F.createPropertyAssignment(
                    "schema",
                    F.createIdentifier("schema"),
                  ),
                  F.createPropertyAssignment(
                    "document",
                    F.createIdentifier("doc"),
                  ),
                  F.createPropertyAssignment(
                    "variableValues",
                    F.createIdentifier("variables"),
                  ),
                ]),
              ]),
            ),
          ],
          true,
        ),
      ),
    );
    //
  }

  graphQLImport(name: string): ts.Identifier {
    this._graphQLImports.add(name);
    return F.createIdentifier(name);
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

function jsonAbleToAst(value: any): ts.Expression {
  if (value === null) {
    return F.createNull();
  } else if (value === undefined) {
    return F.createIdentifier("undefined");
  } else if (typeof value === "string") {
    return F.createStringLiteral(value);
  } else if (typeof value === "number") {
    return F.createNumericLiteral(value.toString());
  } else if (typeof value === "boolean") {
    return value ? F.createTrue() : F.createFalse();
  } else if (Array.isArray(value)) {
    return F.createArrayLiteralExpression(
      value.map((v) => jsonAbleToAst(v)),
      true,
    );
  } else if (typeof value === "object") {
    return F.createObjectLiteralExpression(
      Object.entries(value).map(([key, value]) =>
        F.createPropertyAssignment(
          F.createIdentifier(key),
          jsonAbleToAst(value),
        ),
      ),
      true,
    );
  } else {
    throw new Error(`Unexpected value: ${value}`);
  }
}

// add ./ and trim extension
function makeImport(path: string): string {
  return `./${path.replace(/\.[^/.]+$/, "")}`;
}
