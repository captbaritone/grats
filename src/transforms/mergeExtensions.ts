import { DocumentNode, FieldDefinitionNode, visit } from "graphql";
import { extend } from "../utils/helpers";

/**
 * Takes every example of `extend type Foo` and `extend interface Foo` and
 * merges them into the original type/interface definition.
 */
export function mergeExtensions(doc: DocumentNode): DocumentNode {
  const fields = new MultiMap<string, FieldDefinitionNode>();

  // Collect all the fields from the extensions and trim them from the AST.
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
    // Grats does not create these extension types
    ScalarTypeExtension(_) {
      throw new Error("Unexpected ScalarTypeExtension");
    },
    EnumTypeExtension(_) {
      throw new Error("Unexpected EnumTypeExtension");
    },
    SchemaExtension(_) {
      throw new Error("Unexpected SchemaExtension");
    },
  });

  // Merge collected extension fields into the original type/interface definition.
  return visit(sansExtensions, {
    ObjectTypeDefinition(t) {
      const extensions = fields.get(t.name.value);
      if (extensions.length === 0) {
        return undefined;
      }
      if (t.fields == null) {
        return { ...t, fields: extensions };
      }
      return { ...t, fields: [...t.fields, ...extensions] };
    },
    InterfaceTypeDefinition(t) {
      const extensions = fields.get(t.name.value);
      if (extensions.length === 0) {
        return undefined;
      }
      if (t.fields == null) {
        return { ...t, fields: extensions };
      }
      return { ...t, fields: [...t.fields, ...extensions] };
    },
  });
}

// Map a key to an array of values.
class MultiMap<K, V> {
  private readonly map = new Map<K, V[]>();

  push(key: K, value: V): void {
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
