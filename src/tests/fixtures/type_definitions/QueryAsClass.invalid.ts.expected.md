## input

```ts title="type_definitions/QueryAsClass.invalid.ts"
/** @gqlType */
export default class Query {
  /** @gqlField */
  hello: string;
}
```

## Output

### Error Report

```text
src/tests/fixtures/type_definitions/QueryAsClass.invalid.ts:2:22 - error: Operation types `Query`, `Mutation`, and `Subscription` must be defined as type aliases of `unknown`. E.g. `type Query = unknown`. This is because GraphQL servers do not have an agreed upon way to produce root values, and Grats errs on the side of safety. If you are trying to implement dependency injection, consider using the `context` argument passed to each resolver instead. If you have a strong use case for a concrete root value, please file an issue.

2 export default class Query {
                       ~~~~~
```