// Because @gqlAnnotate can go on argument definitions which don't have any
// `@gql` tag, we can't report this as an error for now.

/**
 * @gqlAnnotate max(foo: ["a", "b"])
 */
export function foo() {}
