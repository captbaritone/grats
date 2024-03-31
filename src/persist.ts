import {
  FieldNode,
  GraphQLField,
  GraphQLObjectType,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
  TypeInfo,
} from "graphql";
import * as ts from "typescript";
import { nullThrows } from "./utils/helpers";
import { FunctionResolver, PropertyResolver, ResolverArg } from "./IR";
import { resolveRelativePath } from "./gratsRoot";
import path = require("path");

const F = ts.factory;

export function persist(
  schema: GraphQLSchema,
  destination: string,
  operation: OperationDefinitionNode,
): string {
  const persister = new Persister(schema, destination);

  persister.operation(operation);

  return persister.print();
}

class Persister {
  _schema: GraphQLSchema;
  _destination: string;
  _imports: ts.Statement[] = [];
  _helpers: Map<string, ts.Statement> = new Map();
  _typeDefinitions: Set<string> = new Set();
  _graphQLImports: Set<string> = new Set();
  _statements: ts.Statement[] = [];
  _typeInfo: TypeInfo;

  constructor(schema: GraphQLSchema, destination: string) {
    this._schema = schema;
    this._typeInfo = new TypeInfo(schema);
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

  print(): string {
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const sourceFile = ts.createSourceFile(
      "tempFile.ts",
      "",
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.TS,
    );

    /*
    this.import(
      "graphql",
      [...this._graphQLImports].map((name) => ({ name })),
    );
    */

    return printer.printList(
      ts.ListFormat.MultiLine,
      F.createNodeArray([
        ...this._imports,
        ...this._helpers.values(),
        ...this._statements,
      ]),
      sourceFile,
    );
  }

  operation(operation: OperationDefinitionNode) {
    this._typeInfo.enter(operation);
    this.functionDeclaration(
      "execute",
      [F.createModifier(ts.SyntaxKind.ExportKeyword)],
      undefined,
      [
        F.createParameterDeclaration(undefined, undefined, "source"),
        F.createParameterDeclaration(undefined, undefined, "variables"),
      ],
      this.createBlockWithScope(() => {
        this._statements.push(
          F.createReturnStatement(this.selectionSet(operation.selectionSet)),
        );
      }),
    );
    this._typeInfo.leave(operation);
  }

  selectionSet(selectionSet: SelectionSetNode): ts.ObjectLiteralExpression {
    this._typeInfo.enter(selectionSet);
    const obj = selectionSet.selections.map((selection) => {
      return this.selection(selection);
    });
    this._typeInfo.leave(selectionSet);
    return F.createObjectLiteralExpression(obj, true);
  }

  selection(selection: SelectionNode): ts.ObjectLiteralElementLike {
    switch (selection.kind) {
      case Kind.FIELD: {
        this._typeInfo.enter(selection);
        const field = this.field(selection);
        this._typeInfo.leave(selection);
        return field;
      }
      default:
        throw new Error(`Unsupported selection kind: ${selection.kind}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  field(field: FieldNode): ts.ObjectLiteralElementLike {
    this._typeInfo.enter(field);
    const type = nullThrows(this._typeInfo.getType());
    const fieldDef = nullThrows(this._typeInfo.getFieldDef());
    const resolve = this.resolveMethod(fieldDef, field.name.value, type.name);

    let value = F.createPropertyAssignment(
      F.createIdentifier(field.alias?.value ?? field.name.value),
      resolve,
    );
    const selectionSet = field.selectionSet;
    if (selectionSet != null) {
      value = F.createGetAccessorDeclaration(
        undefined,
        field.alias?.value ?? field.name.value,
        [],
        undefined,
        this.createBlockWithScope(() => {
          this._statements.push(
            F.createVariableStatement(
              undefined,
              F.createVariableDeclarationList(
                [
                  F.createVariableDeclaration(
                    "source",
                    undefined,
                    undefined,
                    resolve,
                  ),
                ],
                ts.NodeFlags.Const,
              ),
            ),
          );
          this._statements.push(
            F.createReturnStatement(this.selectionSet(selectionSet)),
          );
        }),
      );
      //
    }
    this._typeInfo.leave(field);
    return value;
  }

  resolveMethod(
    field: GraphQLField<unknown, unknown>,
    methodName: string,
    parentTypeName: string,
  ): ts.Expression {
    const signature = nullThrows(field.astNode).resolverSignature;
    switch (signature.kind) {
      case "property":
        return this.resolvePropertyMethod(field, methodName, signature);
      case "function":
        return this.resolveFunctionMethod(
          field,
          methodName,
          parentTypeName,
          signature,
        );
      default: {
        throw new Error(
          // @ts-expect-error
          `Unexpected resolver signature kind: ${signature.kind}`,
        );
      }
    }
  }

  resolveFunctionMethod(
    field: GraphQLField<unknown, unknown>,
    methodName: string,
    parentTypeName: string,
    signature: FunctionResolver,
  ): ts.CallExpression {
    const module = signature.tsModulePath;

    const exportName = signature.exportName;

    const abs = resolveRelativePath(module);
    const relative = stripExt(
      path.relative(path.dirname(this._destination), abs),
    );

    // Note: This name is guaranteed to be unique, but for static methods, it
    // means we import the same class multiple times with multiple names.
    const resolverName = formatResolverFunctionVarName(
      parentTypeName,
      field.name,
    );

    const modulePath = `./${normalizeRelativePathToPosix(relative)}`;

    if (exportName == null) {
      this.importDefault(modulePath, resolverName);
    } else {
      this.import(modulePath, [{ name: exportName, as: resolverName }]);
    }

    let resolverAccess: ts.Expression = F.createIdentifier(resolverName);

    if (signature.methodName != null) {
      resolverAccess = F.createPropertyAccessExpression(
        resolverAccess,
        F.createIdentifier(signature.methodName),
      );
    }

    return F.createCallExpression(
      resolverAccess,
      undefined,
      getArgs(signature.args),
    );
  }

  // Returns source.someField
  resolvePropertyMethod(
    field: GraphQLField<unknown, unknown>,
    methodName: string,
    signature: PropertyResolver,
  ): ts.Expression {
    const prop = F.createPropertyAccessExpression(
      F.createIdentifier("source"),
      F.createIdentifier(signature.name || field.name),
    );

    let valueExpression: ts.Expression = prop;

    if (signature.args != null) {
      valueExpression = F.createCallExpression(
        prop,
        undefined,
        getArgs(signature.args),
      );
    }

    return valueExpression;
  }

  param(name: string, type?: ts.TypeNode): ts.ParameterDeclaration {
    return F.createParameterDeclaration(
      undefined,
      undefined,
      name,
      undefined,
      type,
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

  importDefault(from: string, as: string) {
    this._imports.push(
      F.createImportDeclaration(
        undefined,
        F.createImportClause(false, F.createIdentifier(as), undefined),
        F.createStringLiteral(from),
      ),
    );
  }

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

  functionDeclaration(
    name: string,
    modifiers: ts.Modifier[] | undefined,
    type: ts.TypeNode | undefined,
    params: ts.ParameterDeclaration[],
    body: ts.Block,
  ): void {
    this._statements.push(
      F.createFunctionDeclaration(
        modifiers,
        undefined,
        name,
        undefined,
        params,
        type,
        body,
      ),
    );
  }
}

function stripExt(filePath: string): string {
  const ext = path.extname(filePath);
  return filePath.slice(0, -ext.length);
}

function getArgs(argSignatures: readonly ResolverArg[]): ts.Expression[] {
  return argSignatures.map((arg) => {
    switch (arg.kind) {
      case "positionalArg":
        return F.createPropertyAccessExpression(
          F.createIdentifier("args"),
          F.createIdentifier(arg.name),
        );
      case "argsObj":
        return F.createIdentifier("args");
      case "source":
        return F.createIdentifier("source");
      case "context":
        return F.createIdentifier("context");
      default:
        throw new Error(`Unexpected arg kind: ${arg.kind}`);
    }
  });
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
