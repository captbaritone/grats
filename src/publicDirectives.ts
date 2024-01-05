import {
  ConstDirectiveNode,
  DefinitionNode,
  DocumentNode,
  Kind,
  Location,
  parse,
} from "graphql";

/**
 * Grats supports some additional, non-spec server directives in order to
 * support experimental GraphQL features. This module contains the definition(s)
 * of those directives.
 */

export const SEMANTIC_NON_NULL_DIRECTIVE = "semanticNonNull";

// Copied from https://github.com/apollographql/specs/blob/ec27a720e588a8531315c37eda85b668fd612199/nullability/v0.1/nullability-v0.1.graphql#L11
export const DIRECTIVES_AST: DocumentNode = parse(`
"""
Indicates that a field is only null if there is a matching error in the \`errors\` array.
In all other cases, the field is non-null.

Tools doing code generation may use this information to generate the field as non-null.

This directive can be applied on field definitions:

\`\`\`graphql
type User {
    email: String @semanticNonNull
}
\`\`\`

It can also be applied on object type extensions for use in client applications that do
not own the base schema:

\`\`\`graphql
extend type User @semanticNonNull(field: "email")
\`\`\`

Control over list items is done using the \`level\` argument:

\`\`\`graphql
type User {
    # friends is nullable but friends[0] is null only on errors
    friends: [User] @semanticNonNull(level: 1)
}
\`\`\`

The \`field\` argument is the name of the field if \`@semanticNonNull\` is applied to an object definition.
If \`@semanticNonNull\` is applied to a field definition, \`field\` must be null.

The \`level\` argument can be used to indicate what level is semantically non null in case of lists.
\`level\` starts at 0 if there is no list. If \`level\` is null, all levels are semantically non null.
"""
directive @semanticNonNull(field: String = null, level: Int = null) repeatable on FIELD_DEFINITION | OBJECT
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
    name: { kind: Kind.NAME, loc, value: SEMANTIC_NON_NULL_DIRECTIVE },
  };
}
