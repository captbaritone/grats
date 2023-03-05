import type { TSESTree } from "@typescript-eslint/types";
import {
  FieldDefinitionNode,
  ObjectTypeDefinitionNode,
  InputValueDefinitionNode,
  TypeNode,
  Kind,
  DocumentNode,
} from "graphql";

const LIBRARY_NAME = "tsql";
const TYPE_DECORATOR_NAME = "ObjectType";
const FIELD_DECORATOR_NAME = "Field";

type GraphqlDecorator = {
  type: "GraphqlDecorator";
};

export type GraphqlSchema = {
  typeDefinitions: ObjectTypeDefinitionNode[];
};

export type Diagnostic = {
  message: string;
  location: TSESTree.SourceLocation;
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
): Result<DocumentNode, Array<Diagnostic>> {
  const traverse = new Traverse();
  traverse.program(program);
  if (traverse._diagnostics.length > 0) {
    return { type: "ERROR", error: traverse._diagnostics };
  }
  const typeDefinitions = traverse._graphqlDefinitions;
  const doc = {
    kind: Kind.DOCUMENT,
    definitions: typeDefinitions,
  } as const;
  return { type: "OK", value: doc };
}

class Traverse {
  _graphqlDefinitions: ObjectTypeDefinitionNode[] = [];
  _diagnostics: Diagnostic[] = [];
  _scopeManager: ScopeManager;

  report(message: string, loc: TSESTree.SourceLocation): null {
    this._diagnostics.push({ message, location: loc });
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
    this._diagnostics.push({ message: fullMessage, location: loc });
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
    const graphqlDecorator = this.graphqlTypeDecorator(classDeclaration);
    if (graphqlDecorator == null) {
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

  methodDefinition(
    methodDefinition: TSESTree.MethodDefinition,
  ): FieldDefinitionNode | null {
    const graphqlDecorator = this.graphqlFieldDecorator(methodDefinition);
    if (graphqlDecorator == null) {
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
          loc: null,
          description: null,
          name: {
            kind: Kind.NAME,
            loc: null,
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
              loc: null,
              description: null,
              name: {
                kind: Kind.NAME,
                loc: null,
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
            loc: null,
            name: {
              kind: Kind.NAME,
              loc: null,
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
    const graphqlDecorator = this.graphqlFieldDecorator(propertyDefinition);
    if (graphqlDecorator == null) {
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
          loc: null,
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
          loc: null,
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
            // TODO: Assert there are no type parameters.
            // TODO: Assert this is a GraphQL type.
            return {
              kind: Kind.NAMED_TYPE,
              loc: null,
              name: {
                kind: Kind.NAME,
                value: typeReference.typeName.name,
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

  graphqlTypeDecorator(
    classDeclaration: TSESTree.ClassDeclaration,
  ): GraphqlDecorator | null {
    if (classDeclaration.decorators == null) {
      return null;
    }
    // TODO: Validate that there is only one decorator.
    for (const decorator of classDeclaration.decorators) {
      switch (decorator.expression.type) {
        case "Identifier":
          if (decorator.expression.name === TYPE_DECORATOR_NAME) {
            return { type: "GraphqlDecorator" };
          }
          break;
        default:
          return this.reportUnimplemented(
            `Unexpected decorator type: ${decorator.expression.type}`,
            decorator.expression.loc,
          );
      }
    }
    return null;
  }

  graphqlFieldDecorator(
    methodDefinition: TSESTree.MethodDefinition | TSESTree.PropertyDefinition,
  ): GraphqlDecorator | null {
    if (methodDefinition.decorators == null) {
      return null;
    }
    // TODO: Validate that there is only one decorator.
    for (const decorator of methodDefinition.decorators) {
      switch (decorator.expression.type) {
        case "Identifier":
          if (decorator.expression.name === FIELD_DECORATOR_NAME) {
            return { type: "GraphqlDecorator" };
          }
          break;
        default:
          return this.reportUnimplemented(
            `Unexpected decorator type: ${decorator.expression.type}`,
            decorator.expression.loc,
          );
      }
    }
    return null;
  }
}
