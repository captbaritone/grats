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
} from "graphql";
import * as ts from "typescript";
import { AbstractFieldDefinitionNode } from "./TypeContext";
import {
  ExportedMetadata,
  PropertyNameMetadata,
  makeAsyncIterableDirective,
  makeExportedDirective,
  makePropertyNameDirective,
} from "./metadataDirectives";

export class GraphQLConstructor {
  /* Metadata Directives */
  exportedDirective(
    node: ts.Node,
    exported: ExportedMetadata,
  ): ConstDirectiveNode {
    return makeExportedDirective(this._loc(node), exported);
  }

  propertyNameDirective(
    node: ts.Node,
    propertyName: PropertyNameMetadata,
  ): ConstDirectiveNode {
    return makePropertyNameDirective(this._loc(node), propertyName);
  }

  asyncIterableDirective(node: ts.Node): ConstDirectiveNode {
    return makeAsyncIterableDirective(this._loc(node));
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
      loc: this._loc(node),
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
      loc: this._loc(node),
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
      loc: this._loc(node),
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
      loc: this._loc(node),
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
  ): AbstractFieldDefinitionNode {
    return {
      kind: "AbstractFieldDefinition",
      loc: this._loc(node),
      onType,
      field,
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
  ): FieldDefinitionNode {
    return {
      kind: Kind.FIELD_DEFINITION,
      loc: this._loc(node),
      description: description ?? undefined,
      name,
      type,
      arguments: args ?? undefined,
      directives: this._optionalList(directives),
    };
  }

  constObjectField(
    node: ts.Node,
    name: NameNode,
    value: ConstValueNode,
  ): ConstObjectFieldNode {
    return { kind: Kind.OBJECT_FIELD, loc: this._loc(node), name, value };
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
      loc: this._loc(node),
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
      loc: this._loc(node),
      description: description ?? undefined,
      name,
      directives,
    };
  }

  scalarTypeDefinition(
    node: ts.Node,
    name: NameNode,
    description: StringValueNode | null,
  ): ScalarTypeDefinitionNode {
    return {
      kind: Kind.SCALAR_TYPE_DEFINITION,
      loc: this._loc(node),
      description: description ?? undefined,
      name,
      directives: undefined,
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
      loc: this._loc(node),
      description: description ?? undefined,
      name,
      fields: fields ?? undefined,
      directives: this._optionalList(directives),
    };
  }

  /* Primitives */
  name(node: ts.Node, value: string): NameNode {
    return { kind: Kind.NAME, loc: this._loc(node), value };
  }
  namedType(node: ts.Node, value: string): NamedTypeNode {
    return {
      kind: Kind.NAMED_TYPE,
      loc: this._loc(node),
      name: this.name(node, value),
    };
  }

  object(
    node: ts.Node,
    fields: ReadonlyArray<ConstObjectFieldNode>,
  ): ConstObjectValueNode {
    return { kind: Kind.OBJECT, loc: this._loc(node), fields };
  }

  /* Helpers */
  nonNullType(node: ts.Node, type: TypeNode): NonNullTypeNode {
    if (type.kind === Kind.NON_NULL_TYPE) {
      return type;
    }
    return { kind: Kind.NON_NULL_TYPE, loc: this._loc(node), type };
  }
  nullableType(type: TypeNode): NamedTypeNode | ListTypeNode {
    let inner = type;
    while (inner.kind === Kind.NON_NULL_TYPE) {
      inner = inner.type;
    }
    return inner;
  }
  listType(node: ts.Node, type: TypeNode): ListTypeNode {
    return { kind: Kind.LIST_TYPE, loc: this._loc(node), type };
  }

  list(node: ts.Node, values: ConstValueNode[]): ConstListValueNode {
    return { kind: Kind.LIST, loc: this._loc(node), values };
  }

  constArgument(
    node: ts.Node,
    name: NameNode,
    value: ConstValueNode,
  ): ConstArgumentNode {
    return { kind: Kind.ARGUMENT, loc: this._loc(node), name, value };
  }

  constDirective(
    node: ts.Node,
    name: NameNode,
    args: ReadonlyArray<ConstArgumentNode> | null,
  ): ConstDirectiveNode {
    return {
      kind: Kind.DIRECTIVE,
      loc: this._loc(node),
      name,
      arguments: this._optionalList(args),
    };
  }

  string(node: ts.Node, value: string, block?: boolean): StringValueNode {
    return { kind: Kind.STRING, loc: this._loc(node), value, block };
  }

  float(node: ts.Node, value: string): FloatValueNode {
    return { kind: Kind.FLOAT, loc: this._loc(node), value };
  }

  int(node: ts.Node, value: string): IntValueNode {
    return { kind: Kind.INT, loc: this._loc(node), value };
  }

  null(node: ts.Node): NullValueNode {
    return { kind: Kind.NULL, loc: this._loc(node) };
  }

  boolean(node: ts.Node, value: boolean): BooleanValueNode {
    return { kind: Kind.BOOLEAN, loc: this._loc(node), value };
  }

  _optionalList<T>(input: readonly T[] | null): readonly T[] | undefined {
    if (input == null || input.length === 0) {
      return undefined;
    }
    return input;
  }

  // TODO: This is potentially quite expensive, and we only need it if we report
  // an error at one of these locations. We could consider some trick to return a
  // proxy object that would lazily compute the line/column info.
  _loc(node: ts.Node): GraphQLLocation {
    const sourceFile = node.getSourceFile();
    const source = new Source(sourceFile.text, sourceFile.fileName);
    const startToken = this._dummyToken(sourceFile, node.getStart());
    const endToken = this._dummyToken(sourceFile, node.getEnd());
    return new GraphQLLocation(startToken, endToken, source);
  }

  _dummyToken(sourceFile: ts.SourceFile, pos: number): Token {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
    return new Token(TokenKind.SOF, pos, pos, line, character, undefined);
  }
}
