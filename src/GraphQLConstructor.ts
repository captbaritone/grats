import {
  Kind,
  ListTypeNode,
  NamedTypeNode,
  Location as GraphQLLocation,
  NameNode,
  Source,
  Token,
  TokenKind,
  TypeNode,
  NonNullTypeNode,
  StringValueNode,
  ConstValueNode,
  ConstDirectiveNode,
  ConstArgumentNode,
  UnionTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  FloatValueNode,
  IntValueNode,
  NullValueNode,
  BooleanValueNode,
  ConstListValueNode,
  ConstObjectValueNode,
  ConstObjectFieldNode,
  ObjectTypeDefinitionNode,
  EnumValueDefinitionNode,
  ScalarTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  EnumTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  ASTNode,
  ObjectTypeExtensionNode,
} from "graphql";
import * as ts from "typescript";
import {
  makeKillsParentOnExceptionDirective,
  FIELD_RESOLVER_DIRECTIVE,
} from "./metadataDirectives";
import { uniqueId } from "./utils/helpers";
import { DiagnosticResult, TsLocatableNode } from "./utils/DiagnosticError";
import {
  InputValueDefinitionNodeOrResolverArg,
  Resolver,
} from "./resolverDirective";

export class GraphQLConstructor {
  // TODO: This feels extremely verbose. We could consider a more compact
  fieldResolverDirective(resolver: Resolver): ConstDirectiveNode {
    switch (resolver.kind) {
      case "property": {
        const propertyFields: ConstObjectFieldNode[] = [];
        if (resolver.name != null) {
          propertyFields.push(
            this.constObjectField(
              resolver.node,
              this.name(resolver.node, "name"),
              this.string(resolver.node, resolver.name),
            ),
          );
        }
        return this.constDirective(
          resolver.node,
          this.name(resolver.node, FIELD_RESOLVER_DIRECTIVE),
          [
            this.constArgument(
              resolver.node,
              this.name(resolver.node, "kind"),
              this.object(resolver.node, [
                this.constObjectField(
                  resolver.node,
                  this.name(resolver.node, "property"),
                  this.object(resolver.node, propertyFields),
                ),
              ]),
            ),
          ],
        );
      }
      case "function": {
        const functionFields: ConstObjectFieldNode[] = [
          this.constObjectField(
            resolver.node,
            this.name(resolver.node, "path"),
            this.string(resolver.node, resolver.path),
          ),
        ];
        if (resolver.exportName != null) {
          functionFields.push(
            this.constObjectField(
              resolver.node,
              this.name(resolver.node, "exportName"),
              this.string(resolver.node, resolver.exportName),
            ),
          );
        }
        if (resolver.arguments != null) {
          functionFields.push(
            this.constObjectField(
              resolver.node,
              this.name(resolver.node, "arguments"),
              this.list(
                resolver.node,
                resolver.arguments.map((arg) => {
                  return this.object(resolver.node, [
                    this.constObjectField(
                      resolver.node,
                      this.name(resolver.node, arg.kind),
                      this.boolean(resolver.node, true),
                    ),
                  ]);
                }),
              ),
            ),
          );
        }
        return this.constDirective(
          resolver.node,
          this.name(resolver.node, FIELD_RESOLVER_DIRECTIVE),
          [
            this.constArgument(
              resolver.node,
              this.name(resolver.node, "kind"),
              this.object(resolver.node, [
                this.constObjectField(
                  resolver.node,
                  this.name(resolver.node, "function"),
                  this.object(resolver.node, functionFields),
                ),
              ]),
            ),
          ],
        );
      }
      case "method": {
        const methodFields: ConstObjectFieldNode[] = [];
        if (resolver.name != null) {
          methodFields.push(
            this.constObjectField(
              resolver.node,
              this.name(resolver.node, "name"),
              this.string(resolver.node, resolver.name),
            ),
          );
        }
        if (resolver.arguments != null) {
          methodFields.push(
            this.constObjectField(
              resolver.node,
              this.name(resolver.node, "arguments"),
              this.list(
                resolver.node,
                resolver.arguments.map((arg) => {
                  return this.object(resolver.node, [
                    this.constObjectField(
                      resolver.node,
                      this.name(resolver.node, arg.kind),
                      this.boolean(resolver.node, true),
                    ),
                  ]);
                }),
              ),
            ),
          );
        }
        return this.constDirective(
          resolver.node,
          this.name(resolver.node, FIELD_RESOLVER_DIRECTIVE),
          [
            this.constArgument(
              resolver.node,
              this.name(resolver.node, "kind"),
              this.object(resolver.node, [
                this.constObjectField(
                  resolver.node,
                  this.name(resolver.node, "method"),
                  this.object(resolver.node, methodFields),
                ),
              ]),
            ),
          ],
        );
      }
      case "staticMethod": {
        const staticMethodFields: ConstObjectFieldNode[] = [
          this.constObjectField(
            resolver.node,
            this.name(resolver.node, "path"),
            this.string(resolver.node, resolver.path),
          ),
          this.constObjectField(
            resolver.node,
            this.name(resolver.node, "name"),
            this.string(resolver.node, resolver.name),
          ),
        ];
        if (resolver.exportName != null) {
          staticMethodFields.push(
            this.constObjectField(
              resolver.node,
              this.name(resolver.node, "exportName"),
              this.string(resolver.node, resolver.exportName),
            ),
          );
        }
        if (resolver.arguments != null) {
          staticMethodFields.push(
            this.constObjectField(
              resolver.node,
              this.name(resolver.node, "arguments"),
              this.list(
                resolver.node,
                resolver.arguments.map((arg) => {
                  return this.object(arg.node, [
                    this.constObjectField(
                      arg.node,
                      this.name(arg.node, arg.kind),
                      this.boolean(arg.node, true),
                    ),
                  ]);
                }),
              ),
            ),
          );
        }
        return this.constDirective(
          resolver.node,
          this.name(resolver.node, FIELD_RESOLVER_DIRECTIVE),
          [
            this.constArgument(
              resolver.node,
              this.name(resolver.node, "kind"),
              this.object(resolver.node, [
                this.constObjectField(
                  resolver.node,
                  this.name(resolver.node, "staticMethod"),
                  this.object(resolver.node, staticMethodFields),
                ),
              ]),
            ),
          ],
        );
      }
      default: {
        throw new Error("unreachable");
      }
    }
  }

  killsParentOnExceptionDirective(node: ts.Node): ConstDirectiveNode {
    return makeKillsParentOnExceptionDirective(loc(node));
  }

  /* Top Level Types */
  unionTypeDefinition(
    node: ts.Node,
    name: NameNode,
    types: NamedTypeNode[],
    description: StringValueNode | null,
  ): UnionTypeDefinitionNode {
    return {
      kind: Kind.UNION_TYPE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      types,
    };
  }

  objectTypeDefinition(
    node: ts.Node,
    name: NameNode,
    fields: FieldDefinitionNode[],
    interfaces: NamedTypeNode[] | null,
    description: StringValueNode | null,
    hasTypeNameField: boolean,
    exported: {
      tsModulePath: string;
      exportName: string | null;
    } | null,
  ): ObjectTypeDefinitionNode {
    return {
      kind: Kind.OBJECT_TYPE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      fields,
      interfaces: interfaces ?? undefined,
      hasTypeNameField: hasTypeNameField,
      exported: exported ?? undefined,
    };
  }

  interfaceTypeDefinition(
    node: ts.Node,
    name: NameNode,
    fields: FieldDefinitionNode[],
    interfaces: NamedTypeNode[] | null,
    description: StringValueNode | null,
  ): InterfaceTypeDefinitionNode {
    return {
      kind: Kind.INTERFACE_TYPE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      directives: undefined,
      name,
      fields,
      interfaces: interfaces ?? undefined,
    };
  }

  enumTypeDefinition(
    node: ts.Node,
    name: NameNode,
    values: readonly EnumValueDefinitionNode[],
    description: StringValueNode | null,
  ): EnumTypeDefinitionNode {
    return {
      kind: Kind.ENUM_TYPE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      values,
    };
  }

  /* Top Level Extensions */

  abstractFieldDefinition(
    node: ts.Node,
    onType: NameNode,
    field: FieldDefinitionNode,
  ): ObjectTypeExtensionNode {
    return {
      kind: Kind.OBJECT_TYPE_EXTENSION,
      loc: loc(node),
      name: onType,
      fields: [field],
      mayBeInterface: true,
    };
  }

  /* Field Definitions */
  fieldDefinition(
    node: ts.Node,
    name: NameNode,
    type: TypeNode,
    args: readonly InputValueDefinitionNode[] | null,
    directives: readonly ConstDirectiveNode[],
    description: StringValueNode | null,
    resolver: Resolver,
  ): FieldDefinitionNode {
    return {
      kind: Kind.FIELD_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      type,
      arguments: args ?? undefined,
      directives: this._optionalList(directives),
      resolver,
    };
  }

  constObjectField(
    node: ts.Node,
    name: NameNode,
    value: ConstValueNode,
  ): ConstObjectFieldNode {
    return { kind: Kind.OBJECT_FIELD, loc: loc(node), name, value };
  }

  inputValueDefinition(
    node: ts.Node,
    name: NameNode,
    type: TypeNode,
    directives: readonly ConstDirectiveNode[] | null,
    defaultValue: ConstValueNode | null,
    description: StringValueNode | null,
  ): InputValueDefinitionNode {
    return {
      kind: Kind.INPUT_VALUE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      type,
      defaultValue: defaultValue ?? undefined,
      directives: this._optionalList(directives),
    };
  }

  inputValueDefinitionOrResolverArg(
    node: ts.Node,
    name: DiagnosticResult<NameNode>,
    type: TypeNode,
    directives: readonly ConstDirectiveNode[] | null,
    defaultValue: ConstValueNode | null,
    description: StringValueNode | null,
  ): InputValueDefinitionNodeOrResolverArg {
    return {
      kind: Kind.INPUT_VALUE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      type,
      defaultValue: defaultValue ?? undefined,
      directives: this._optionalList(directives),
    };
  }

  enumValueDefinition(
    node: ts.Node,
    name: NameNode,
    directives: readonly ConstDirectiveNode[] | undefined,
    description: StringValueNode | null,
  ): EnumValueDefinitionNode {
    return {
      kind: Kind.ENUM_VALUE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      directives,
    };
  }

  scalarTypeDefinition(
    node: ts.Node,
    name: NameNode,
    directives: readonly ConstDirectiveNode[] | null,
    description: StringValueNode | null,
  ): ScalarTypeDefinitionNode {
    return {
      kind: Kind.SCALAR_TYPE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      directives: this._optionalList(directives),
    };
  }

  inputObjectTypeDefinition(
    node: ts.Node,
    name: NameNode,
    fields: InputValueDefinitionNode[] | null,
    directives: readonly ConstDirectiveNode[] | null,
    description: StringValueNode | null,
  ): InputObjectTypeDefinitionNode {
    return {
      kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      fields: fields ?? undefined,
      directives: this._optionalList(directives),
    };
  }

  /* Primitives */
  name(node: ts.Node, value: string): NameNode {
    return {
      kind: Kind.NAME,
      loc: loc(node),
      value,
      tsIdentifier: uniqueId(),
    };
  }
  namedType(node: ts.Node, value: string): NamedTypeNode {
    return {
      kind: Kind.NAMED_TYPE,
      loc: loc(node),
      name: this.name(node, value),
    };
  }

  object(
    node: ts.Node,
    fields: ReadonlyArray<ConstObjectFieldNode>,
  ): ConstObjectValueNode {
    return { kind: Kind.OBJECT, loc: loc(node), fields };
  }

  /* Helpers */
  nonNullType(node: ts.Node, type: TypeNode): NonNullTypeNode {
    if (type.kind === Kind.NON_NULL_TYPE) {
      return type;
    }
    return { kind: Kind.NON_NULL_TYPE, loc: loc(node), type };
  }
  nullableType(type: TypeNode): NamedTypeNode | ListTypeNode {
    let inner = type;
    while (inner.kind === Kind.NON_NULL_TYPE) {
      inner = inner.type;
    }
    return inner;
  }
  listType(node: ts.Node, type: TypeNode): ListTypeNode {
    return { kind: Kind.LIST_TYPE, loc: loc(node), type };
  }

  list(node: ts.Node, values: ConstValueNode[]): ConstListValueNode {
    return { kind: Kind.LIST, loc: loc(node), values };
  }

  withLocation<T = ASTNode>(node: ts.Node, value: T): T {
    return { ...value, loc: loc(node) };
  }

  constArgument(
    node: ts.Node,
    name: NameNode,
    value: ConstValueNode,
  ): ConstArgumentNode {
    return { kind: Kind.ARGUMENT, loc: loc(node), name, value };
  }

  constDirective(
    node: ts.Node,
    name: NameNode,
    args: ReadonlyArray<ConstArgumentNode> | null,
  ): ConstDirectiveNode {
    return {
      kind: Kind.DIRECTIVE,
      loc: loc(node),
      name,
      arguments: this._optionalList(args),
    };
  }

  string(node: ts.Node, value: string, block?: boolean): StringValueNode {
    return { kind: Kind.STRING, loc: loc(node), value, block };
  }

  float(node: ts.Node, value: string): FloatValueNode {
    return { kind: Kind.FLOAT, loc: loc(node), value };
  }

  int(node: ts.Node, value: string): IntValueNode {
    return { kind: Kind.INT, loc: loc(node), value };
  }

  null(node: ts.Node): NullValueNode {
    return { kind: Kind.NULL, loc: loc(node) };
  }

  boolean(node: ts.Node, value: boolean): BooleanValueNode {
    return { kind: Kind.BOOLEAN, loc: loc(node), value };
  }

  _optionalList<T>(input: readonly T[] | null): readonly T[] | undefined {
    if (input == null || input.length === 0) {
      return undefined;
    }
    return input;
  }
}

// TODO: This is potentially quite expensive, and we only need it if we report
// an error at one of these locations. We could consider some trick to return a
// proxy object that would lazily compute the line/column info.
export function loc(node: TsLocatableNode): GraphQLLocation {
  const sourceFile = node.getSourceFile();
  const source = new Source(sourceFile.text, sourceFile.fileName);
  const startToken = _dummyToken(sourceFile, node.getStart());
  const endToken = _dummyToken(sourceFile, node.getEnd());
  return new GraphQLLocation(startToken, endToken, source);
}

function _dummyToken(sourceFile: ts.SourceFile, pos: number): Token {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  return new Token(TokenKind.SOF, pos, pos, line, character, undefined);
}
