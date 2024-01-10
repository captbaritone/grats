import { DocumentNode, Kind, NameNode, visit } from "graphql";
import { naturalCompare } from "../utils/naturalCompare";

/*
 * Similar to lexicographicSortSchema from graphql-js but applied against an AST
 * instead of a `GraphQLSchema`. Note that this creates some subtle differences,
 * such as the presence of schema directives, which are not preserved in a
 * `GraphQLSchema`.
 */
export function sortSchemaAst(doc: DocumentNode): DocumentNode {
  return visit(doc, {
    ScalarTypeDefinition(t) {
      return { ...t, directives: sortNamed(t.directives) };
    },
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
    UnionTypeDefinition(t) {
      return {
        ...t,
        directives: sortNamed(t.directives),
        types: sortNamed(t.types),
      };
    },
    EnumTypeDefinition(t) {
      return {
        ...t,
        directives: sortNamed(t.directives),
        values: sortNamed(t.values),
      };
    },
    InputObjectTypeDefinition(t) {
      return {
        ...t,
        directives: sortNamed(t.directives),
        fields: sortNamed(t.fields),
      };
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
    InputValueDefinition(t) {
      return { ...t, directives: sortNamed(t.directives) };
    },
    Directive(t) {
      return { ...t, arguments: sortNamed(t.arguments) };
    },
  });
}

type Named = { kind: Kind; name?: NameNode };

// Given an optional array of AST nodes, sort them by name or kind.
function sortNamed<T extends Named>(arr?: readonly T[]): T[] | undefined {
  if (arr == null) {
    return arr;
  }
  return Array.from(arr).sort(compareByName);
}

// Note that we use `naturalCompare` here instead of `localeCompare`. This has
// three motivations:
//
// * It matches the behavior of `lexicographicSortSchema` from graphql-js.
// * It's stable across locales so users in different locales won't generate
//   different outputs from the same input resulting in unnecessary diffs.
// * It's likely a more user-friendly sort order than simple > or <.
function compareByName<T extends Named>(a: T, b: T): number {
  // If both are unnamed, sort by kind
  if (a.name == null && b.name == null) {
    return naturalCompare(a.kind, b.kind);
  }
  // Unnamed things go first
  if (a.name == null) {
    return -1;
  }
  if (b.name == null) {
    return 1;
  }

  return naturalCompare(a.name.value, b.name.value);
}
