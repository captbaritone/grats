import { DocumentNode, FieldDefinitionNode, visit } from "graphql";
import { DefaultMap, extend } from "../utils/helpers";

/**
 * Takes every example of `extend type Foo` and `extend interface Foo` and
 * merges them into the original type/interface definition.
 */
export function mergeExtensions(doc: DocumentNode): DocumentNode {
  const merger = new ExtensionMerger();
  return merger.mergeExtensions(doc);
}

class ExtensionMerger {
  _fields: MultiMap<string, FieldDefinitionNode>;
  _interfaceMap: DefaultMap<string, Set<string>>;
  constructor() {
    this._fields = new MultiMap<string, FieldDefinitionNode>();
    this._interfaceMap = new DefaultMap<string, Set<string>>(() => new Set());
  }

  mergeExtensions(doc: DocumentNode): DocumentNode {
    const sansExtensions = this.collectFieldsAndExtensions(doc);

    this.propagateMissingFields(sansExtensions);

    // Merge collected extension fields into the original type/interface definition.
    return visit(sansExtensions, {
      ObjectTypeDefinition: (t) => {
        const extensions = this._fields.get(t.name.value);
        return { ...t, fields: extensions };
      },
      InterfaceTypeDefinition: (t) => {
        const extensions = this._fields.get(t.name.value);
        return { ...t, fields: extensions };
      },
    });
  }

  // Propagate fields from interfaces to their implementing types.
  // GraphQL expects all types and interfaces to explicitly define all fields, including
  // those required by interfaces they implement. They way Grats works, if a field is defined
  // on an interface, that field is provably present on all implementing types.
  propagateMissingFields(sansExtensions: DocumentNode) {
    const processedInterfaces = new Set<string>();

    const extendObject = (name: string): void => {
      const ownFields = this._fields.get(name);
      for (const iface of this._interfaceMap.get(name)) {
        // First make sure the interface has been fully populated
        extendInterface(iface);
        const ifaceFields = this._fields.get(iface);
        for (const field of ifaceFields) {
          if (!ownFields.some((f) => f.name.value === field.name.value)) {
            ownFields.push(field);
          }
        }
      }
    };

    const extendInterface = (name: string): void => {
      // Avoid duplicate processing and infinite recursion
      if (processedInterfaces.has(name)) {
        return;
      }
      // This does not _correctly_ handle recursive interfaces, but that's okay
      // since some other validation pass should detect that. The main issues is
      // to avoid infinite recursion leading to a stack overflow.
      processedInterfaces.add(name);
      const ownFields = this._fields.get(name);
      for (const iface of this._interfaceMap.get(name)) {
        extendInterface(iface);
        const ifaceFields = this._fields.get(iface);
        for (const field of ifaceFields) {
          if (!ownFields.some((f) => f.name.value === field.name.value)) {
            ownFields.push(field);
          }
        }
      }
    };

    for (const doc of sansExtensions.definitions) {
      switch (doc.kind) {
        case "ObjectTypeDefinition":
          extendObject(doc.name.value);
          break;
        case "InterfaceTypeDefinition":
          extendInterface(doc.name.value);
          break;
      }
    }
  }

  // Collect all the fields and interfaces from the extensions and trim them from the AST.
  collectFieldsAndExtensions(doc: DocumentNode): DocumentNode {
    return visit(doc, {
      ObjectTypeExtension: (t) => {
        if (t.directives != null || t.interfaces != null) {
          throw new Error("Unexpected directives or interfaces on Extension");
        }
        this._fields.extend(t.name.value, t.fields);
        return null;
      },
      InterfaceTypeExtension: (t) => {
        if (t.directives != null || t.interfaces != null) {
          throw new Error("Unexpected directives or interfaces on Extension");
        }
        this._fields.extend(t.name.value, t.fields);
        return null;
      },
      ObjectTypeDefinition: (t) => {
        if (t.interfaces != null) {
          for (const i of t.interfaces) {
            this._interfaceMap.get(t.name.value).add(i.name.value);
          }
        }
        this._fields.extend(t.name.value, t.fields);
        return t;
      },
      InterfaceTypeDefinition: (t) => {
        if (t.interfaces != null) {
          for (const i of t.interfaces) {
            this._interfaceMap.get(t.name.value).add(i.name.value);
          }
        }
        this._fields.extend(t.name.value, t.fields);
        return t;
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
  }
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
