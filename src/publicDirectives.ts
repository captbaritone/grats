import {
  ConstDirectiveNode,
  DefinitionNode,
  DocumentNode,
  Kind,
  Location,
  parse,
} from "graphql";
import { uniqueId } from "./utils/helpers";

/**
 * Grats supports some additional, non-spec server directives in order to
 * support experimental GraphQL features. This module contains the definition(s)
 * of those directives.
 */

export const SEMANTIC_NON_NULL_DIRECTIVE = "semanticNonNull";

// Copied from https://github.com/apollographql/specs/blob/2a22ccf054994392a1b14d8810787cb27baee040/nullability/v0.2/nullability-v0.2.graphql#L1C1-L33C68
export const DIRECTIVES_AST: DocumentNode = parse(`
"""
Indicates that a position is semantically non null: it is only null if there is a matching error in the \`errors\` array.
In all other cases, the position is non-null.

Tools doing code generation may use this information to generate the position as non-null if field errors are handled out of band:

\`\`\`graphql
type User {
    # email is semantically non-null and can be generated as non-null by error-handling clients.
    email: String @semanticNonNull
}
\`\`\`

The \`levels\` argument indicates what levels are semantically non null in case of lists:

\`\`\`graphql
type User {
    # friends is semantically non null
    friends: [User] @semanticNonNull # same as @semanticNonNull(levels: [0])

    # every friends[k] is semantically non null
    friends: [User] @semanticNonNull(levels: [1])

    # friends as well as every friends[k] is semantically non null
    friends: [User] @semanticNonNull(levels: [0, 1])
}
\`\`\`

\`levels\` are zero indexed.
Passing a negative level or a level greater than the list dimension is an error.
"""
directive @semanticNonNull(levels: [Int] = [0]) on FIELD_DEFINITION
`);

export function addSemanticNonNullDirective(
  definitions: readonly DefinitionNode[],
): Array<DefinitionNode> {
  return [...DIRECTIVES_AST.definitions, ...definitions];
}

export function makeSemanticNonNullDirective(
  loc: Location,
): ConstDirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    loc,
    name: {
      kind: Kind.NAME,
      loc,
      value: SEMANTIC_NON_NULL_DIRECTIVE,
      tsIdentifier: uniqueId(),
    },
  };
}
