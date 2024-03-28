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
  TS_MODULE_PATH_ARG,
  FIELD_NAME_ARG,
  ARG_COUNT,
  FIELD_METADATA_DIRECTIVE,
  EXPORT_NAME_ARG,
  ResolverSignature,
} from "./metadataDirectives";
import { uniqueId } from "./utils/helpers";
import { TsLocatableNode } from "./utils/DiagnosticError";

export class GraphQLConstructor {
  fieldMetadataDirective(
    node: ts.Node,
    metadata: {
      tsModulePath: string | null;
      name: string | null;
      exportName: string | null;
      argCount: number | null;
    },
  ): ConstDirectiveNode {
    const args: ConstArgumentNode[] = [];
    if (metadata.tsModulePath != null) {
      args.push(
        this.constArgument(
          node,
          this.name(node, TS_MODULE_PATH_ARG),
          this.string(node, metadata.tsModulePath),
        ),
      );
    }
    if (metadata.name != null) {
      args.push(
        this.constArgument(
          node,
          this.name(node, FIELD_NAME_ARG),
          this.string(node, metadata.name),
        ),
      );
    }
    if (metadata.exportName != null) {
      args.push(
        this.constArgument(
          node,
          this.name(node, EXPORT_NAME_ARG),
          this.string(node, metadata.exportName),
        ),
      );
    }
    if (metadata.argCount != null) {
      args.push(
        this.constArgument(
          node,
          this.name(node, ARG_COUNT),
          this.int(node, metadata.argCount.toString()),
        ),
      );
    }

    return this.constDirective(
      node,
      this.name(node, FIELD_METADATA_DIRECTIVE),
      args,
    );
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
  ): ObjectTypeDefinitionNode {
    return {
      kind: Kind.OBJECT_TYPE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      directives: undefined,
      name,
      fields,
      interfaces: interfaces ?? undefined,
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
    resolverSignature: ResolverSignature,
  ): FieldDefinitionNode {
    return {
      kind: Kind.FIELD_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      type,
      arguments: args ?? undefined,
      directives: this._optionalList(directives),
      resolverSignature,
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
    argIndex?: number,
  ): InputValueDefinitionNode {
    return {
      kind: Kind.INPUT_VALUE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      type,
      defaultValue: defaultValue ?? undefined,
      directives: this._optionalList(directives),
      argIndex,
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
