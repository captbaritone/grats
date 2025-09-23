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
  DirectiveDefinitionNode,
  EnumValueNode,
} from "graphql";
import * as ts from "typescript";
import { uniqueId } from "./utils/helpers";
import { DiagnosticResult, TsLocatableNode } from "./utils/DiagnosticError";
import {
  InputValueDefinitionNodeOrResolverArg,
  ResolverSignature,
} from "./resolverSignature";

export class GraphQLConstructor {
  /* Top Level Types */
  directiveDefinition(
    node: ts.Node,
    name: NameNode,
    args: readonly InputValueDefinitionNode[] | null,
    repeatable: boolean,
    locations: readonly NameNode[],
    description: StringValueNode | null,
  ): DirectiveDefinitionNode {
    return {
      kind: Kind.DIRECTIVE_DEFINITION,
      loc: loc(node),
      name,
      // "Real" arguments are undefined for now. Later they will be derived from
      // `resolverArgs`.
      arguments: this._optionalList(args),
      repeatable,
      locations,
      description: description ?? undefined,
    };
  }

  unionTypeDefinition(
    node: ts.Node,
    name: NameNode,
    types: NamedTypeNode[],
    description: StringValueNode | null,
    directives: readonly ConstDirectiveNode[] | null,
  ): UnionTypeDefinitionNode {
    return {
      kind: Kind.UNION_TYPE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      types,
      directives: this._optionalList(directives),
    };
  }

  objectTypeDefinition(
    node: ts.Node,
    name: NameNode,
    fields: FieldDefinitionNode[],
    interfaces: NamedTypeNode[] | null,
    description: StringValueNode | null,
    directives: readonly ConstDirectiveNode[] | null,
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
      directives: this._optionalList(directives),
    };
  }

  interfaceTypeDefinition(
    node: ts.Node,
    name: NameNode,
    fields: FieldDefinitionNode[],
    interfaces: NamedTypeNode[] | null,
    description: StringValueNode | null,
    directives: readonly ConstDirectiveNode[] | null,
  ): InterfaceTypeDefinitionNode {
    return {
      kind: Kind.INTERFACE_TYPE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      fields,
      interfaces: interfaces ?? undefined,
      directives: this._optionalList(directives),
    };
  }

  enumTypeDefinition(
    node: ts.Node,
    name: NameNode,
    values: readonly EnumValueDefinitionNode[],
    description: StringValueNode | null,
    directives: readonly ConstDirectiveNode[] | null,
  ): EnumTypeDefinitionNode {
    return {
      kind: Kind.ENUM_TYPE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      values,
      directives: this._optionalList(directives),
    };
  }

  /* Top Level Extensions */

  abstractFieldDefinition(
    node: ts.Node,
    onType: NameNode,
    field: FieldDefinitionNode,
    mayBeInterface: boolean = true,
  ): ObjectTypeExtensionNode {
    return {
      kind: Kind.OBJECT_TYPE_EXTENSION,
      loc: loc(node),
      name: onType,
      fields: [field],
      mayBeInterface,
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
    killsParentOnException: NameNode | null,
    resolver: ResolverSignature,
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
      killsParentOnException: killsParentOnException ?? undefined,
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
    tsName: string | null,
  ): EnumValueDefinitionNode {
    return {
      kind: Kind.ENUM_VALUE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      directives,
      tsName: tsName ?? undefined,
    };
  }

  scalarTypeDefinition(
    node: ts.Node,
    name: NameNode,
    directives: readonly ConstDirectiveNode[] | null,
    description: StringValueNode | null,
    exported: {
      tsModulePath: string;
      exportName: string;
    } | null,
  ): ScalarTypeDefinitionNode {
    return {
      kind: Kind.SCALAR_TYPE_DEFINITION,
      loc: loc(node),
      description: description ?? undefined,
      name,
      directives: this._optionalList(directives),
      exported,
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
    isAmbiguous: boolean = false,
  ): ConstDirectiveNode {
    return {
      kind: Kind.DIRECTIVE,
      loc: loc(node),
      name,
      arguments: this._optionalList(args),
      isAmbiguous,
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
  enum(node: ts.Node, value: string): EnumValueNode {
    return { kind: Kind.ENUM, loc: loc(node), value };
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
