# Directive Definitions

You can define GraphQL directives by placing a `@gqlDirective` before a:

-   Function declaration

```tsx
import { Int } from "grats";
/**
 * @gqlDirective on FIELD_DEFINITION
 */
function cost(args: { credits: Int }) {
  // ...
}
```

By default, the directive is defined as a metadata-only function — Grats will not invoke it. However, having a function whose type matches the arguments of your directive can be useful for writing code which will accept the arguments of your directive.

To annotate part of your schema with a directive, see [`@gqlAnnotate`](./directive-annotations.md).

## Locations

The text after the `@gqlDirective` tag is parsed similarly to a a GraphQL directive definition:

1.  An optional name for the directive (the function name will be used if no name is provided)
2.  An optional `repeatable` keyword if the directive is repeatable
3.  The `on` keyword followed by a list of directive [locations](https://spec.graphql.org/October2021/#DirectiveLocation) separated by `|`.

```tsx
import { Int } from "grats";
/**
 * @gqlDirective cost repeatable on FIELD_DEFINITION | OBJECT
 */
function applyCost(args: { credits: Int }) {
  // ...
}
```

## Arguments

The first argument of the directive function is an object containing the directive’s GraphQL arguments. This mirrors the [Object-style map fields](./arguments.md#object-map-style-fields) style supported by field resolvers.

_All other arguments to the directive function are ignored by Grats._ This allows the function to be used as part of the implementation of the directive’s behavior.

```tsx
type SomeType = any;
/**
 * @gqlDirective on FIELD_DEFINITION
 */
function myDirective(args: { someArg: string }, someNonGqlArg: SomeType) {}
```

Default values in this style can be defined by using the `=` operator with destructuring. Note that you must perform the destructuring in the argument list, not in the function body:

```tsx
/**
 * @gqlDirective on FIELD_DEFINITION
 */
function myDirective({ greeting = "Hello" }: { greeting: string }) {}
```

Arguments can be marked as `@deprecated` by using the `@deprecated` JSDoc tag:

```tsx
/**
 * @gqlDirective on FIELD_DEFINITION
 */
function myDirective(args: {
  /** @deprecated Unused! */
  someArg?: string | null;
}) {
  // ...
}
```

## Field Directive Wrappers

For directives on `FIELD_DEFINITION` that need to execute logic at runtime (e.g. auth checks, rate limiting, logging), you can have your directive function return `FieldDirective` from `grats`. When Grats sees this return type, it will automatically wrap the field's resolver with your directive function — no manual `mapSchema` wiring required.

```tsx
import { Int, FieldDirective } from "grats";
/**
 * Limits the rate of field resolution.
 * @gqlDirective on FIELD_DEFINITION
 */
export function rateLimit(args: { max: Int }): FieldDirective {
  return (next) => (source, args, context, info) => {
    // Custom logic runs before the resolver
    return next(source, args, context, info);
  };
}
```

The directive function is called with its arguments and must return a function that takes the next resolver and returns a wrapped resolver. Multiple `FieldDirective` directives on the same field compose naturally — the outermost directive in the annotation list wraps first.

For directives that are purely metadata (consumed by clients or infrastructure rather than during execution), omit the return type or return `void`.
