import {
  ConstDirectiveNode,
  GraphQLAbstractType,
  GraphQLField,
  GraphQLObjectType,
  GraphQLSchema,
} from "graphql";
import * as ts from "typescript";
import * as path from "path";
import { resolveRelativePath } from "./gratsRoot";
import { SEMANTIC_NON_NULL_DIRECTIVE } from "./publicDirectives";
import {
  ASSERT_NON_NULL_HELPER,
  createAssertNonNullHelper,
} from "./codegenHelpers";
import { nullThrows } from "./utils/helpers";
import { GratsConfig } from "./gratsConfig.js";
import { naturalCompare } from "./utils/naturalCompare";
import { Resolver, ResolverArgument } from "./resolverDirective";

const RESOLVER_ARGS: string[] = ["source", "args", "context", "info"];

const F = ts.factory;

// Given a GraphQL SDL, returns the a string of TypeScript code that generates a
// GraphQLSchema implementing that schema.
export function codegen(
  schema: GraphQLSchema,
  config: GratsConfig,
  destination: string,
): string {
  const codegen = new Codegen(schema, config, destination);

  codegen.resolverMapExport();

  return codegen.print();
}

class Codegen {
  _imports: ts.Statement[] = [];
  _typeNameMappings: Map<string, string> = new Map();
  _helpers: Map<string, ts.Statement> = new Map();
  _typeDefinitions: Set<string> = new Set();
  _graphQLToolsUtilsImports: Set<string> = new Set();
  _statements: ts.Statement[] = [];

  constructor(
    public _schema: GraphQLSchema,
    public _config: GratsConfig,
    public _destination: string,
  ) {}

  createBlockWithScope(closure: () => void): ts.Block {
    const initialStatements = this._statements;
    this._statements = [];
    closure();
    const block = F.createBlock(this._statements, true);
    this._statements = initialStatements;
    return block;
  }

  graphQLToolsUtilsImport(name: string): ts.Identifier {
    this._graphQLToolsUtilsImports.add(name);
    return F.createIdentifier(name);
  }

  graphQLTypeImport(
    name: string,
    typeArguments?: readonly ts.TypeNode[],
  ): ts.TypeReferenceNode {
    this._graphQLToolsUtilsImports.add(name);
    return F.createTypeReferenceNode(name, typeArguments);
  }

  resolverMapExport(): void {
    this.functionDeclaration(
      "getResolverMap",
      [F.createModifier(ts.SyntaxKind.ExportKeyword)],
      // TODO[x]: Import resolver map type
      this.graphQLTypeImport("IResolvers"),
      this.createBlockWithScope(() => {
        this._statements.push(
          F.createReturnStatement(this.objectLiteral(this.types())),
        );
      }),
    );
  }

  types(): ts.ObjectLiteralElementLike[] {
    return Object.values(this._schema.getTypeMap())
      .filter((type) => {
        return type instanceof GraphQLObjectType && !type.name.startsWith("__");
      })
      .map((type: GraphQLObjectType) => {
        return this.typeObject(type);
      })
      .filter(isNonNull);
  }

  objectType(obj: GraphQLObjectType): ts.Expression | null {
    const fields = Object.entries(obj.getFields())
      .map(([_, field]) => {
        return this.resolver(field, obj.name);
      })
      .filter(isNonNull);

    if (fields.length === 0) {
      return null;
    }
    return this.objectLiteral(fields);
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
      this.importDefault(modulePath, localName);
    } else {
      this.import(modulePath, [{ name: exportName, as: localName }]);
    }
  }

  /**
   * TODO: Derive this from the actual directive?
   */
  resolverSignature(field: GraphQLField<unknown, unknown>): Resolver {
    return nullThrows(field.astNode?.resolver);
  }

  isDefaultResolverSignature(
    field: GraphQLField<unknown, unknown>,
    signature: Resolver,
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
    const signature = this.resolverSignature(field);
    if (this.isDefaultResolverSignature(field, signature)) {
      return null;
    }
    switch (signature.kind) {
      case "property":
        return this.method(
          methodName,
          [this.param("source")],
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
        return this.method(
          methodName,
          extractUsedParams(signature.arguments ?? [], true).map((name) =>
            this.param(name),
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
        return this.method(
          methodName,
          extractUsedParams(signature.arguments ?? [], true).map((name) =>
            this.param(name),
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
        return this.method(
          methodName,
          extractUsedParams(signature.arguments ?? [], true).map((name) =>
            this.param(name),
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
      case "unresolved":
        throw new Error(
          `Unexpected unresolved resolver argument during codegen`,
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
      this._helpers.set(ASSERT_NON_NULL_HELPER, createAssertNonNullHelper());
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
    return this.method(
      "resolve",
      RESOLVER_ARGS.map((name) => this.param(name)),
      [
        F.createReturnStatement(
          F.createCallExpression(
            this.graphQLToolsUtilsImport("defaultFieldResolver"),
            undefined,
            RESOLVER_ARGS.map((name) => F.createIdentifier(name)),
          ),
        ),
      ],
    );
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

  resolver(
    field: GraphQLField<unknown, unknown>,
    parentTypeName: string,
  ): ts.ObjectLiteralElementLike | null {
    // Note: We assume the default name is used here. When custom operation types are supported
    // we'll need to update this.
    // if (parentTypeName !== "Subscription") {
    const resolve = this.resolveMethod(field, field.name, parentTypeName);
    return this.maybeApplySemanticNullRuntimeCheck(field, resolve);
    //  }
    throw new Error("TODO: Implement subscription resolvers");
    // return [
    //   // TODO: Maybe avoid adding `assertNonNull` for subscription resolvers?
    //   this.resolveMethod(field, "subscribe", parentTypeName),
    //   // Identity function (method?)
    //   this.maybeApplySemanticNullRuntimeCheck(
    //     field,
    //     this.method(
    //       "resolve",
    //       [this.param("payload")],
    //       [F.createReturnStatement(F.createIdentifier("payload"))],
    //     ),
    //   ),
    // ];
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

  typeObject(type: GraphQLObjectType): ts.PropertyAssignment | null {
    const resolvers = Object.entries(type.getFields())
      .map(([_, field]) => {
        return this.resolver(field, type.name);
      })
      .filter(isNonNull);
    if (resolvers.length === 0) {
      return null;
    }
    const resolversObj = this.objectLiteral(resolvers);
    return F.createPropertyAssignment(type.name, resolversObj);
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
    type: ts.TypeNode | undefined,
    body: ts.Block,
  ): void {
    this._statements.push(
      F.createFunctionDeclaration(
        modifiers,
        undefined,
        name,
        undefined,
        [],
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
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const sourceFile = ts.createSourceFile(
      "tempFile.ts",
      "",
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.TS,
    );

    this.import(
      "@graphql-tools/utils",
      [...this._graphQLToolsUtilsImports].map((name) => ({ name })),
    );

    if (this._typeNameMappings.size > 0) {
      this._statements.push(
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
        this._statements.push(
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
      this._statements.push(this.resolveTypeFunctionDeclaration());
    }

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

// https://github.com/sindresorhus/slash/blob/98b618f5a3bfcb5dd374b204868818845b87bb2f/index.js#L8C9-L8C33
function normalizeRelativePathToPosix(unknownPath: string): string {
  return unknownPath.replace(/\\/g, "/");
}
