import {
  DocumentNode,
  EnumTypeExtensionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  ScalarTypeDefinitionNode,
  SchemaExtensionNode,
} from "graphql";

type Mapper = {
  ObjectTypeExtension?: (
    node: ObjectTypeExtensionNode,
  ) => ObjectTypeExtensionNode | null;
  InterfaceTypeExtension?: (
    node: InterfaceTypeExtensionNode,
  ) => InterfaceTypeExtensionNode | null;
  ObjectTypeDefinition?: (
    node: ObjectTypeDefinitionNode,
  ) => ObjectTypeDefinitionNode | null;
  InterfaceTypeDefinition?: (
    node: InterfaceTypeDefinitionNode,
  ) => InterfaceTypeDefinitionNode | null;
  ScalarTypeDefinition?: (
    node: ScalarTypeDefinitionNode,
  ) => ScalarTypeDefinitionNode | null;
  ScalarTypeExtension?: (
    node: ScalarTypeDefinitionNode,
  ) => ScalarTypeDefinitionNode | null;
  EnumTypeExtension?: (
    node: EnumTypeExtensionNode,
  ) => EnumTypeExtensionNode | null;
  SchemaExtension?: (node: SchemaExtensionNode) => SchemaExtensionNode | null;
};

type Visitor = {
  ObjectTypeExtension?: (node: ObjectTypeExtensionNode) => undefined;
  InterfaceTypeExtension?: (node: InterfaceTypeExtensionNode) => undefined;
  ObjectTypeDefinition?: (node: ObjectTypeDefinitionNode) => undefined;
  InterfaceTypeDefinition?: (node: InterfaceTypeDefinitionNode) => undefined;
  ScalarTypeDefinition?: (node: ScalarTypeDefinitionNode) => undefined;
  ScalarTypeExtension?: (node: ScalarTypeDefinitionNode) => undefined;
  EnumTypeExtension?: (node: EnumTypeExtensionNode) => undefined;
  SchemaExtension?: (node: SchemaExtensionNode) => undefined;
};

/**
 * Simplified, more performant, version of graphql-js's visit function that only
 * visits the top-level definitions in a DocumentNode.
 */
export function visitDefinitions(doc: DocumentNode, visitors: Visitor) {
  doc.definitions.forEach((def) => {
    const visitor = visitors[def.kind as keyof Visitor];
    if (visitor == null) {
      return;
    }
    visitor(def as any);
  });
}

const emptyArray = [];

/**
 * Simplified, more performant, version of graphql-js's visit function that only
 * visits the top-level definitions in a DocumentNode.
 */
export function mapDefinitions(
  doc: DocumentNode,
  visitors: Mapper,
): DocumentNode {
  return {
    ...doc,
    definitions: doc.definitions.flatMap((def) => {
      const visitor = visitors[def.kind as keyof Visitor];
      if (visitor == null) {
        return def;
      }
      const result = visitor(def as any);
      if (result == null) {
        return emptyArray;
      }
      return result;
    }),
  };
}
