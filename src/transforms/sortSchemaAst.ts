import { DocumentNode, Kind, NameNode, visit } from "graphql";

export function sortSchemaAst(doc: DocumentNode): DocumentNode {
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
      return t;
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
