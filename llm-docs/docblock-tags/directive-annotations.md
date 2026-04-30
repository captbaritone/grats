# Directive Annotations

You can annotate constructs in your Grats GraphQL schema with [GraphQL directives](https://spec.graphql.org/October2021/#sec-Language.Directives) using the `@gqlAnnotate` docblock tag.

```tsx
/** @gqlDirective on FIELD_DEFINITION */
function myDirective() {
  // ...
}
/**
 * @gqlQueryField
 * @gqlAnnotate myDirective
 */
export function greet(): string {
  return "Hello";
}
```

Directive annotations can also accept arguments using [GraphQL syntax](https://spec.graphql.org/October2021/#sec-Language.Directives) for arguments:

```tsx
/** @gqlDirective on FIELD_DEFINITION */
function myDirective(args: { someArg: string }) {
  // ...
}
/**
 * @gqlQueryField
 * @gqlAnnotate myDirective(someArg: "Some String")
 */
export function greet(): string {
  return "Hello";
}
```

> **NOTE:**
> The GraphQL directive `@deprecated` is unique in that it is a built-in GraphQL directive _and_ has a built-in TypeScript equivalent in the form of the `@deprecated` docblock tag. Because of this, TypeScript `@deprecated` docblock tags are automatically converted into GraphQL `@deprecated` directives.

## Directive Validation

While the GraphQL Spec does not actually specify that arguments passed to directives used in the schema should be validated against the types specified in that directive's declaration, **Grats adds its own validation** to ensure that arguments used in `@gqlAnnotate` are typechecked against their directive declaration.

## Schema Directive Annotations at Runtime

Directive annotations added to your schema will be included in Grats' generated `.graphql` file. For directives meant to be consumed by clients or other infrastructure, this should be sufficient.

For field directives that need to run logic at runtime (auth, rate limiting, logging, etc.), the recommended approach is to have your directive function return [`FieldDirective`](./directive-definitions.md#field-directive-wrappers). Grats will automatically wrap the field resolver with your directive function — no manual wiring needed.

You can find an example of this in action in the [`production-app`](../examples/production-app.md) example where we define a field directive `@cost` which implements API rate limiting.

### Manual directive access via extensions

For directives on non-field locations, or when you need more control, Grats also includes directive annotations as part of the relevant GraphQL class' `extensions` object namespaced under a `grats` key:

```ts
const foo = {
  extensions: {
    grats: {
      directives: [
        {
          name: "myDirective",
          args: { someArg: "Some Value" },
        },
      ],
    },
  },
};
```

This can be consumed using tools like `@graphql-tools/utils` with `mapSchema` and `getDirective`.
