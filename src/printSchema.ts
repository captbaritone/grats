import {
  DocumentNode,
  GraphQLSchema,
  print,
  printSchema,
  visit,
  specifiedScalarTypes,
  NameNode,
  Kind,
  FieldDefinitionNode,
} from "graphql";
import { ConfigOptions } from "./lib";
import { codegen } from "./codegen";
import { METADATA_DIRECTIVE_NAMES } from "./metadataDirectives";
import { extend } from "./utils/helpers";

/**
 * Prints code for a TypeScript module that exports a GraphQLSchema.
 * Includes the user-defined (or default) header comment if provided.
 */
export function printExecutableSchema(
  schema: GraphQLSchema,
  config: ConfigOptions,
  destination: string,
): string {
  const code = codegen(schema, destination);
  if (config.tsSchemaHeader) {
    return `${config.tsSchemaHeader}\n${code}`;
  }
  return code;
}

/**
 * Prints SDL, potentially omitting directives depending upon the config.
 * Includes the user-defined (or default) header comment if provided.
 */
export function printGratsSDL(
  doc: DocumentNode,
  config: ConfigOptions,
): string {
  const sdl = printSDLWithoutDirectives(doc);

  if (config.schemaHeader) {
    return `${config.schemaHeader}\n${sdl}`;
  }
  return sdl;
}

export function printSDLWithoutDirectives(doc: DocumentNode): string {
  const trimmed = visit(doc, {
    DirectiveDefinition(t) {
      if (METADATA_DIRECTIVE_NAMES.has(t.name.value)) {
        return null;
      }
      return t;
    },
    Directive(t) {
      if (METADATA_DIRECTIVE_NAMES.has(t.name.value)) {
        return null;
      }
      return t;
    },
    ScalarTypeDefinition(t) {
      if (specifiedScalarTypes.some((scalar) => scalar.name === t.name.value)) {
        return null;
      }
      return t;
    },
  });
  return print(sortDocument(mergeExtensions(trimmed)));
}

export function printSDLFromSchemaWithoutDirectives(
  schema: GraphQLSchema,
): string {
  return printSchema(
    new GraphQLSchema({
      ...schema.toConfig(),
      directives: schema.getDirectives().filter((directive) => {
        return !METADATA_DIRECTIVE_NAMES.has(directive.name);
      }),
    }),
  );
}

// Take every extension and merge it into the base type definition.
function mergeExtensions(doc: DocumentNode): DocumentNode {
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

function sortDocument(doc: DocumentNode): DocumentNode {
  return visit(doc, {
    ObjectTypeDefinition(t) {
      return {
        ...t,
        directives: sortNamed(t.directives),
        interfaces: sortNamed(t.interfaces),
        fields: sortNamed(t.fields),
      };
    },
    InterfaceTypeDefinition(t) {
      return {
        ...t,
        directives: sortNamed(t.directives),
        interfaces: sortNamed(t.interfaces),
        fields: sortNamed(t.fields),
      };
    },
    ScalarTypeDefinition(t) {
      return { ...t, directives: sortNamed(t.directives) };
    },
    Document(t) {
      return { ...t, definitions: sortNamed(t.definitions) };
    },
    FieldDefinition(t) {
      return {
        ...t,
        directives: sortNamed(t.directives),
        arguments: sortNamed(t.arguments),
      };
    },
    Directive(t) {
      return { ...t, arguments: sortNamed(t.arguments) };
    },
    EnumTypeDefinition(t) {
      return { ...t, values: sortNamed(t.values) };
    },
    UnionTypeDefinition(t) {
      return { ...t, types: sortNamed(t.types) };
    },
  });
}

type Named = { kind: Kind; name?: NameNode };

function sortNamed<T extends Named>(arr?: readonly T[]): T[] | undefined {
  if (arr == null) {
    return arr;
  }
  return Array.from(arr).sort(sortByName);
}

function sortByName<T extends Named>(a: T, b: T): number {
  // If both are unnamed, sort by kind
  if (a.name == null && b.name == null) {
    return a.kind.localeCompare(b.kind);
  }
  // Unnamed things go first
  if (a.name == null) {
    return -1;
  }
  if (b.name == null) {
    return 1;
  }

  return a.name.value.localeCompare(b.name.value);
}
