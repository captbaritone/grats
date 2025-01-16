import { DocumentNode, Kind, visit } from "graphql";

/**
 * Filter out DocBlock tags which could be interpreted as either GraphQL directives
 * without arguments or docblock tags, but are not defined in the schema.
 */
export function filterNonGqlDirectives(doc: DocumentNode): DocumentNode {
  const validDirectiveNames = new Set<string>();
  visit(doc, {
    [Kind.DIRECTIVE_DEFINITION](node) {
      validDirectiveNames.add(node.name.value);
    },
  });

  return visit(doc, {
    [Kind.DIRECTIVE](node) {
      if (node.isAmbiguous && !validDirectiveNames.has(node.name.value)) {
        return null;
      }
      return node;
    },
  });
  //
}
