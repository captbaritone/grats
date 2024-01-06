import { DocumentNode, FieldDefinitionNode, visit } from "graphql";
import { extend } from "../utils/helpers";

// Take every extension and merge it into the base type definition.
export function mergeExtensions(doc: DocumentNode): DocumentNode {
  const fields = new MultiMap<string, FieldDefinitionNode>();
  const sansExtensions = visit(doc, {
    ObjectTypeExtension(t) {
      if (t.directives != null || t.interfaces != null) {
        throw new Error("Unexpected directives or interfaces on Extension");
      }
      fields.extend(t.name.value, t.fields);
      return null;
    },
    InterfaceTypeExtension(t) {
      if (t.directives != null || t.interfaces != null) {
        throw new Error("Unexpected directives or interfaces on Extension");
      }
      fields.extend(t.name.value, t.fields);
      return null;
    },
  });
  return visit(sansExtensions, {
    ObjectTypeDefinition(t) {
      const extensions = fields.get(t.name.value);
      if (t.fields == null) {
        return { ...t, fields: extensions };
      }
      return { ...t, fields: [...t.fields, ...extensions] };
    },
    InterfaceTypeDefinition(t) {
      const extensions = fields.get(t.name.value);
      if (t.fields == null) {
        return { ...t, fields: extensions };
      }
      return { ...t, fields: [...t.fields, ...extensions] };
    },
  });
}

class MultiMap<K, V> {
  private readonly map = new Map<K, V[]>();

  set(key: K, value: V): void {
    let existing = this.map.get(key);
    if (existing == null) {
      existing = [];
      this.map.set(key, existing);
    }
    existing.push(value);
  }

  extend(key: K, values?: readonly V[]): void {
    if (values == null) {
      return;
    }
    let existing = this.map.get(key);
    if (existing == null) {
      existing = [];
      this.map.set(key, existing);
    }
    extend(existing, values);
  }

  get(key: K): V[] {
    return this.map.get(key) ?? [];
  }
}
