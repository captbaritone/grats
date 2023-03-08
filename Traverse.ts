import type { TSESTree } from "@typescript-eslint/types";
import type { ScopeManager } from "@typescript-eslint/scope-manager";
import { getJSDocTags, getTextOfJSDocComment } from "typescript";
import {
  FieldDefinitionNode,
  ObjectTypeDefinitionNode,
  InputValueDefinitionNode,
  TypeNode,
  Kind,
  DocumentNode,
  GraphQLError,
  Location,
} from "graphql";
import { validateSDL } from "graphql/validation/validate";
import DiagnosticError, { AnnotatedLocation } from "./DiagnosticError";
import { tsLocToGraphQLLoc } from "./Location";
import { ParserServices } from "@typescript-eslint/parser";
import { FILE } from "dns";

const LIBRARY_NAME = "tsql";
const FIELD_TAG = "GQLField";
const TYPE_TAG = "GQLType";

export type GraphqlSchema = {
  typeDefinitions: ObjectTypeDefinitionNode[];
};

export type Result<V, E> =
  | {
      type: "OK";
      value: V;
    }
  | {
      type: "ERROR";
      error: E;
    };

export function traverse(
  program: TSESTree.Program,
  source: string,
  scopeManager: ScopeManager,
  parserServices: ParserServices,
): Result<DocumentNode, Array<DiagnosticError>> {
  const traverse = new Traverse(source, scopeManager, parserServices);
  traverse.program(program);
  if (traverse._diagnostics.length > 0) {
    return { type: "ERROR", error: traverse._diagnostics };
  }
  const typeDefinitions = traverse._graphqlDefinitions;
  const doc = {
    kind: Kind.DOCUMENT,
    definitions: typeDefinitions,
  } as const;

  const validationErrors = validateSDL(doc);
  if (validationErrors.length > 0) {
    return {
      type: "ERROR",
      error: validationErrors.map((error) => {
        return graphQlErrorToDiagnostic(error);
      }),
    };
  }
  return { type: "OK", value: doc };
}

function graphQlErrorToDiagnostic(error: GraphQLError): DiagnosticError {
  const loc = error.locations[0];
  const position = error.positions[0];
  if (loc == null) {
    throw new Error("Expected error to have a location");
  }
  if (position == null) {
    throw new Error("Expected error to have a position");
  }
  const start = {
    offset: position,
    line: loc.line,
    column: loc.column,
  };
  let end = {
    offset: position + 1,
    line: loc.line,
    column: loc.column + 1,
  };

  const related = [];
  for (let i = 1; i < error.locations.length; i++) {
    const loc = error.locations[i];
    const position = error.positions[i];
    if (loc && position) {
      related.push(
        new AnnotatedLocation(
          {
            start: {
              offset: position,
              line: loc.line,
              column: loc.column,
            },
            end: {
              offset: position + 1,
              line: loc.line,
              column: loc.column + 1,
            },
          },
          "",
        ),
      );
    }
  }
  return new DiagnosticError(
    error.message,
    new AnnotatedLocation({ start, end }, ""),
    related,
  );
}

// TS AST Location => GraphQL Location
// TS AST Location => Diagnostic Location
// GraphQL Location => Diagnostic Location

class Traverse {
  _graphqlDefinitions: ObjectTypeDefinitionNode[] = [];
  _diagnostics: DiagnosticError[] = [];
  _source: string;
  _parserServices: ParserServices;
  _scopeManager: ScopeManager;

  constructor(
    source: string,
    scopeManager: ScopeManager,
    parserServices: ParserServices,
  ) {
    this._source = source;
    this._scopeManager = scopeManager;
    this._parserServices = parserServices;
  }

  report(message: string, loc: TSESTree.SourceLocation): null {
    this._diagnostics.push(
      new DiagnosticError(message, new AnnotatedLocation(loc, "")),
    );
    return null;
  }

  reportUnimplemented(message: string, loc: TSESTree.SourceLocation): null {
    const fullMessage =
      "Unimplemented: " +
      message +
      "\n" +
      "(this represents a bug in " +
      LIBRARY_NAME +
      ")";
    this._diagnostics.push(
      new DiagnosticError(fullMessage, new AnnotatedLocation(loc, "")),
    );
    return null;
  }

  program(program: TSESTree.Program) {
    for (const statement of program.body) {
      switch (statement.type) {
        case "ExportDefaultDeclaration": {
          const def = this.exportDefaultDeclaration(statement);
          if (def != null) {
            this._graphqlDefinitions.push(def);
          }
          break;
        }
        case "ExportNamedDeclaration": {
          const def = this.exportNamedDeclaration(statement);
          if (def != null) {
            this._graphqlDefinitions.push(def);
          }
          break;
        }
        case "ClassDeclaration": {
          const def = this.classDeclaration(statement);
          if (def != null) {
            this._graphqlDefinitions.push(def);
          }
        }
        case "FunctionDeclaration":
        case "ImportDeclaration":
        case "VariableDeclaration":
          break;
        default:
          return this.reportUnimplemented(
            `Unexpected statement type: ${statement.type}`,
            statement.loc!,
          );
      }
    }
  }
  exportDefaultDeclaration(
    exportDefaultDeclaration: TSESTree.ExportDefaultDeclaration,
  ): ObjectTypeDefinitionNode | null {
    switch (exportDefaultDeclaration.declaration.type) {
      case "ClassDeclaration":
        return this.classDeclaration(exportDefaultDeclaration.declaration);
      default:
        return this.reportUnimplemented(
          `Unexpected declaration type: ${exportDefaultDeclaration.declaration.type}`,
          exportDefaultDeclaration.loc!,
        );
    }
  }
  exportNamedDeclaration(
    exportNamedDeclaration: TSESTree.ExportNamedDeclaration,
  ): ObjectTypeDefinitionNode | null {
    switch (exportNamedDeclaration.declaration.type) {
      case "ClassDeclaration":
        return this.classDeclaration(exportNamedDeclaration.declaration);
      default:
        return this.reportUnimplemented(
          `Unexpected declaration type: ${exportNamedDeclaration.declaration.type}`,
          exportNamedDeclaration.loc,
        );
    }
  }

  classDeclaration(
    classDeclaration: TSESTree.ClassDeclaration,
  ): ObjectTypeDefinitionNode | null {
    if (!this.hasJSDocTag(classDeclaration, TYPE_TAG)) {
      return;
    }

    const fields = [];
    for (const member of classDeclaration.body.body) {
      switch (member.type) {
        case "MethodDefinition": {
          const field = this.methodDefinition(member);
          if (field != null) {
            fields.push(field);
          }
          break;
        }
        case "PropertyDefinition": {
          const field = this.propertyDefinition(member);
          if (field != null) {
            fields.push(field);
          }
          break;
        }
        default:
          return this.reportUnimplemented(
            `Unexpected member type: ${member.type}`,
            member.loc,
          );
      }
    }
    if (fields.length === 0) {
      // TODO: Could we just let schema validation handle this?
      this.report(
        "Expected GraphQL class to have at least one field",
        classDeclaration.loc!,
      );
      return null;
    }
    return {
      kind: Kind.OBJECT_TYPE_DEFINITION,
      loc: null,
      description: null,
      name: {
        kind: Kind.NAME,
        value: classDeclaration.id.name,
      },
      fields,
    };
  }

  hasJSDocTag(node: TSESTree.Node, tagName: string): boolean {
    const tsNode = this._parserServices.esTreeNodeToTSNodeMap.get(node);
    return getJSDocTags(tsNode).some(
      (tag) => tag.tagName.escapedText === tagName,
    );
  }

  methodDefinition(
    methodDefinition: TSESTree.MethodDefinition,
  ): FieldDefinitionNode | null {
    if (!this.hasJSDocTag(methodDefinition, FIELD_TAG)) {
      return null;
    }

    const args = this.methodParams(methodDefinition.value.params);

    if (methodDefinition.value.returnType == null) {
      return this.report(
        "Expected GraphQL field to have a return type",
        methodDefinition.loc,
      );
    }

    const returnType = this.graphqlReturnTypeFromTypeNode(
      methodDefinition.value.returnType.typeAnnotation,
    );

    // We must have reported an error...
    if (returnType == null) {
      return null;
    }

    switch (methodDefinition.key.type) {
      case "Identifier": {
        return {
          kind: Kind.FIELD_DEFINITION,
          loc: this.graphQLLoc(methodDefinition.loc),
          description: null,
          name: {
            kind: Kind.NAME,
            loc: this.graphQLLoc(methodDefinition.key.loc),
            value: methodDefinition.key.name,
          },
          arguments: args,
          type: returnType,
          directives: null,
        };
      }
      default:
        return this.reportUnimplemented(
          `Unexpected key type: ${methodDefinition.key.type}`,
          methodDefinition.key.loc,
        );
    }
  }

  graphQLLoc(loc: TSESTree.SourceLocation): Location {
    return tsLocToGraphQLLoc(loc, this._source);
  }

  methodParams(
    params: Array<TSESTree.Parameter>,
  ): Array<InputValueDefinitionNode> {
    if (params.length === 0) return [];
    const args = params[0];
    switch (args.type) {
      case "Identifier":
      case "ObjectPattern":
        if (args.typeAnnotation == null) {
          this.report(
            "Expected GraphQL field argument to have an explicit type",
            args.loc,
          );
          return [];
        }
        switch (args.typeAnnotation.typeAnnotation.type) {
          case "TSTypeLiteral":
            return this.argumentsTypeLiteral(
              args.typeAnnotation.typeAnnotation,
            );
          default:
            return this.report(
              `Expected GraphQL field arguments to be typed with an inline type literal. E.g. \`(args: { foo: string })\`.`,
              args.typeAnnotation.typeAnnotation.loc,
            );
        }
      default:
        return this.reportUnimplemented(
          `Graphql field arguments of the type ${args.type} are not supported`,
          args.loc,
        );
    }
  }

  argumentsTypeLiteral(
    literal: TSESTree.TSTypeLiteral,
  ): Array<InputValueDefinitionNode> {
    return literal.members
      .map((member) => {
        switch (member.type) {
          case "TSPropertySignature":
            if (member.key.type !== "Identifier") {
              return this.report(
                "Expected GraphQL argument type definition to have an identifier name.",
                member.key.loc,
              );
            }
            const argType = this.argumentTypeFromTypeNode(
              member.typeAnnotation.typeAnnotation,
            );

            return {
              kind: Kind.INPUT_VALUE_DEFINITION,
              loc: this.graphQLLoc(member.loc),
              description: null,
              name: {
                kind: Kind.NAME,
                loc: this.graphQLLoc(member.key.loc),
                value: member.key.name,
              },
              type: argType,
            } as const;
          default:
            return this.reportUnimplemented(
              "Unexpected member type",
              member.loc,
            );
        }
      })
      .filter(Boolean);
  }

  argumentTypeFromTypeNode(typeNode: TSESTree.TypeNode): TypeNode {
    switch (typeNode.type) {
      case "TSStringKeyword":
        return {
          kind: Kind.NON_NULL_TYPE,
          type: {
            kind: Kind.NAMED_TYPE,
            loc: this.graphQLLoc(typeNode.loc),
            name: {
              kind: Kind.NAME,
              loc: this.graphQLLoc(typeNode.loc),
              value: "String",
            },
          },
        };
      default:
        this.reportUnimplemented("Unexpected type node", typeNode.loc);
    }
  }

  propertyDefinition(
    propertyDefinition: TSESTree.PropertyDefinition,
  ): FieldDefinitionNode | null {
    if (!this.hasJSDocTag(propertyDefinition, "GQLField")) {
      return null;
    }
    if (propertyDefinition.typeAnnotation == null) {
      return this.report(
        "Expected GraphQL field to have a return type",
        propertyDefinition.loc,
      );
    }
    const type = this.graphqlReturnTypeFromTypeNode(
      propertyDefinition.typeAnnotation.typeAnnotation,
    );

    if (propertyDefinition.key.type !== "Identifier") {
      return this.report(
        "Expected GraphQL property definition to have an identifier name.",
        propertyDefinition.key.loc,
      );
    }
    return {
      kind: Kind.FIELD_DEFINITION,
      type,
      name: {
        kind: Kind.NAME,
        value: propertyDefinition.key.name,
      },
    };
  }

  graphqlReturnTypeFromTypeNode(typeNode: TSESTree.TypeNode): TypeNode | null {
    switch (typeNode.type) {
      case "TSStringKeyword":
        return {
          kind: Kind.NAMED_TYPE,
          loc: this.graphQLLoc(typeNode.loc),
          name: {
            kind: Kind.NAME,
            value: "String",
          },
        };
      case "TSNumberKeyword":
        return this.report(
          `The type \`number\` is not supported as a GraphQL return type because it is ambiguous. Use either \`Int\` or \`Float\` imported from \`${LIBRARY_NAME}\`.`,
          typeNode.loc,
        );
      case "TSTypeLiteral":
        return this.report(
          `Complex types are not supported as GraphQL return types. Use either a primitive type, or type that has been annotated with \`@GraphqlType\`.`,
          typeNode.loc,
        );
      case "TSAnyKeyword":
        return this.report(
          `Unexpected \`any\` used as GraphQL return type. Use either a primitive type, or type that has been annotated with \`@GraphqlType\`.`,
          typeNode.loc,
        );
      case "TSTypeReference":
        return this.graphqlReturnTypeFromTypeReference(typeNode);
      case "TSArrayType":
        return {
          kind: Kind.LIST_TYPE,
          loc: this.graphQLLoc(typeNode.loc),
          type: this.graphqlReturnTypeFromTypeNode(typeNode.elementType),
        };
      default:
        return this.reportUnimplemented(
          `Unexpected returnType type: ${typeNode.type}`,
          typeNode.loc,
        );
    }
  }

  graphqlReturnTypeFromTypeReference(
    typeReference: TSESTree.TSTypeReference,
  ): TypeNode {
    switch (typeReference.typeName.type) {
      case "Identifier":
        switch (typeReference.typeName.name) {
          case "Array":
          case "ReadonlyArray":
            // case "Iterable":
            return {
              kind: Kind.LIST_TYPE,
              type: this.graphqlReturnTypeFromTypeNode(
                typeReference.typeParameters.params[0],
              ),
            };
          case "Promise":
            return this.graphqlReturnTypeFromTypeNode(
              typeReference.typeParameters.params[0],
            );
          default:
            const graphqlType = this.lookupGraphqlType(typeReference);
            // TODO: Assert there are no type parameters.
            // TODO: Assert this is a GraphQL type.
            return {
              kind: Kind.NAMED_TYPE,
              loc: this.graphQLLoc(typeReference.loc),
              name: {
                kind: Kind.NAME,
                value: graphqlType,
              },
            };
        }
      default:
        return this.reportUnimplemented(
          `Unexpected typeName type: ${typeReference.typeName.type}`,
          typeReference.typeName.loc,
        );
    }
  }

  lookupGraphqlType(typeReference: TSESTree.TSTypeReference): string | null {
    const scope = getScope(this._scopeManager, typeReference);
    if (scope == null) {
      throw new Error("Could not locate scope for type reference");
    }
    if (typeReference.typeName.type !== "Identifier") {
      throw new Error("Expected type reference to be an identifier");
    }
    const variable = scope.set.get(typeReference.typeName.name);
    if (variable == null) {
      this.report(
        "Expected type reference to be defined.",
        typeReference.typeName.loc,
      );
      return null;
    }
    const definitions = variable.defs;
    if (definitions.length !== 1) {
      this.report(
        "Expected type defined exactly once.",
        typeReference.typeName.loc,
      );
    }
    const def = definitions[0];
    //
    return typeReference.typeName.name;
  }
}

/**
 * Gets the scope for the current node
 * @param {ScopeManager} scopeManager The scope manager for this AST
 * @param {ASTNode} currentNode The node to get the scope of
 * @returns {eslint-scope.Scope} The scope information for this node
 */
// Stolen from eslint: https://github.com/eslint/eslint/blob/75acdd21c5ce7024252e9d41ed77d2f30587caac/lib/linter/linter.js#L860-L883
function getScope(scopeManager: ScopeManager, currentNode: TSESTree.Node) {
  // On Program node, get the outermost scope to avoid return Node.js special function scope or ES modules scope.
  const inner = currentNode.type !== "Program";

  for (let node = currentNode; node; node = node.parent) {
    const scope = scopeManager.acquire(node, inner);

    if (scope) {
      if (scope.type === "function-expression-name") {
        return scope.childScopes[0];
      }
      return scope;
    }
  }

  return scopeManager.scopes[0];
}
