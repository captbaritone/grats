import {
  DocumentNode,
  Kind,
  Location,
  NameNode,
  ObjectTypeDefinitionNode,
  visit,
} from "graphql";
import { OPERATION_TYPES } from "../Extractor";
import { nullThrows } from "../utils/helpers";

/**
 * Ensure any root types which have been extended with `@gqlQueryField` and
 * friends are defined in the schema.
 *
 * If the type has been manually defined, it should not be created, but if it
 * has not, the type should be implicitly added to the schema AST.
 */
export function addImplicitRootTypes(doc: DocumentNode): DocumentNode {
  const extendedRootTypes = new Map<string, Location>();
  const definedRootTypes = new Set<string>();
  visit(doc, {
    [Kind.OBJECT_TYPE_EXTENSION](ext) {
      if (OPERATION_TYPES.has(ext.name.value)) {
        extendedRootTypes.set(ext.name.value, nullThrows(ext.name.loc));
      }
    },
    [Kind.OBJECT_TYPE_DEFINITION](t) {
      if (OPERATION_TYPES.has(t.name.value)) {
        definedRootTypes.add(t.name.value);
      }
    },
  });

  const rootTypes: ObjectTypeDefinitionNode[] = [];

  for (const [typeName, loc] of extendedRootTypes.entries()) {
    if (definedRootTypes.has(typeName)) {
      continue;
    }
    const name: NameNode = {
      kind: Kind.NAME,
      value: typeName,
      tsIdentifier: -1,
      loc,
    };
    rootTypes.push({
      kind: Kind.OBJECT_TYPE_DEFINITION,
      loc,
      name,
      hasTypeNameField: false,
    });
  }
  if (rootTypes.length === 0) {
    return doc;
  }
  return { ...doc, definitions: [...doc.definitions, ...rootTypes] };
}
