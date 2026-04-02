# Inputs

GraphQL input types can be defined by placing a `@gqlInput` docblock directly before a:

-   Type alias declaration
-   Interface declaration

```tsx
/**
 * Description of my input type
 * @gqlInput
 */
type MyInput = {
  name: string;
};
```

_Generated GraphQL schema:_

```graphql
"""Description of my input type"""
input MyInput {
  name: String!
}
```

```tsx
/** @gqlInput */
interface MyInput {
  name: string;
}
```

_Generated GraphQL schema:_

```graphql
input MyInput {
  name: String!
}
```

Unlike with type or interface fields, every property of an input type is automatically included as part of the GraphQL definition. You do not need to annotate individual properties with `@gqlField`.

## Deprecated fields

Individual optional fields can be marked as `@deprecated` in the GraphQL schema using the `@deprecated` JSDoc tag:

```tsx
import { Int } from "grats";

/** @gqlInput */
type MyInput = {
  name: string;
  /** @deprecated Don't ask for age any more */
  age?: Int;
};
```

_Generated GraphQL schema:_

```graphql
input MyInput {
  age: Int @deprecated(reason: "Don't ask for age any more")
  name: String!
}
```

## Merged Interfaces

TypeScript [merges interfaces](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces) if you to define multiple interfaces with the same name in the same scope. For example, `Node` is a built-in interface that describes DOM nodes. So, if you define a `Node` interface in your code, TypeScript will merge your interface with the built-in one.

To avoid ambiguity, Grats will error if you try to define a GraphQL input type using a merged TypeScript interface. To avoid this error you can define a new interface, with a unique name, and then [rename](../resolvers/renaming.md) it to the name you want to use in your schema.
