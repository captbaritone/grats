# Info

In addition to the [arguments](./arguments.md), and [context](./context.md) objects, each resolver method/function may also access the [info](https://graphql.org/learn/execution/#root-fields--resolvers) object. The `info` object contains information about the current execution state, including the field name, field type, and the AST node for the field. It's most commonly used to implement advanced features such as optimizations.

Grats will detect any resolver parameter that is typed using the `GqlInfo` type exported by Grats:

```tsx
import { GqlInfo } from "grats";

/** @gqlQueryField */
export function greeting(info: GqlInfo): string {
  return `Greetings from the ${info.fieldName} field!`;
}
```

_Generated GraphQL schema:_

```graphql
type Query {
  greeting: String
}
```

For an example of using the `info` object to implement a look-ahead optimization, see the look-ahead optimization for Connections to use count query for requests that only read count in `graphql/gqlUtils.ts` in the [Production App Example](../examples/production-app.md).

> **WARNING:**
> You must use the `GqlInfo` exported by Grats, not the `GraphQLResolveInfo` type from `graphql-js`. While they are the same TypeScript type, Grats cannot statically "see" the `graphql-js` type, so it will not be able to pass the `GraphQLResolveInfo` object to your resolver.

> **TIP:**
> Unlike `graphql-js`, Grats does not require that the info object be passed as a specific positional argument to the resolver. You can place the info object anywhere in the argument list, as long as you use the `GqlInfo` type exported by Grats, and Grats will ensure that the info object is passed to the resolver in that position.
