import { Metadata } from "./metadata";

import {
  DocumentNode,
  GraphQLSchema,
  visitWithTypeInfo,
  TypeInfo,
  visit,
  Kind,
  getNamedType,
  isAbstractType,
  isObjectType,
  FieldNode,
} from "graphql";

// Map of used concrete typenames to a set of used fields on that type.
export type UsedFields = Map<string, Set<string>>;

// Given a GraphQL schema and a document (which may contain multiple
// operations), produce a `UsedFields` map representing the concrete fields used
// in the document. Useful for building sub-schema resolver maps scoped to a set
// of operations, such as all the queries included in a JS bundle.
export function extractUsedFields(
  schema: GraphQLSchema,
  operation: DocumentNode,
): UsedFields {
  const usedSchemaMap: UsedFields = new Map();
  const typeInfo = new TypeInfo(schema);

  function addField(typeName: string, fieldName: string) {
    let fieldSet = usedSchemaMap.get(typeName);
    if (fieldSet == null) {
      fieldSet = new Set();
      usedSchemaMap.set(typeName, fieldSet);
    }
    fieldSet.add(fieldName);
  }

  const visitor = {
    [Kind.FIELD](field: FieldNode) {
      const type = getNamedType(typeInfo.getParentType());
      if (isObjectType(type)) {
        addField(type.name, field.name.value);
      } else if (isAbstractType(type)) {
        const possibleTypes = schema.getPossibleTypes(type);
        for (const possibleType of possibleTypes) {
          addField(possibleType.name, field.name.value);
        }
      }
    },
  };

  visit(operation, visitWithTypeInfo(typeInfo, visitor));
  return usedSchemaMap;
}

/**
 * Given a set of used fields, filter a metadata object to only include
 * information about the used fields.
 *
 * Useful for constructing a Metadata object representing a subset of the graph,
 * such as:
 *
 * - A single query or mutation operation
 * - All the queries/mutations used in a given JS bundle
 */
export function filterMetadata(
  usedFields: UsedFields,
  metadata: Metadata,
): Metadata {
  const newMetadata: Metadata = { types: {} };

  for (const [typeName, fields] of Object.entries(metadata.types)) {
    const usedFieldsForType = usedFields.get(typeName);
    if (!usedFieldsForType) {
      continue;
    }
    const newFields = {};
    for (const [fieldName, field] of Object.entries(fields)) {
      if (usedFieldsForType.has(fieldName)) {
        newFields[fieldName] = field;
      }
    }
    if (Object.keys(newFields).length > 0) {
      newMetadata.types[typeName] = newFields;
    }
  }
  return newMetadata;
}
