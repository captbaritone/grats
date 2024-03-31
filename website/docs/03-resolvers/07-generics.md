# Generics

_This page contains the formal documentation of how generics behave in Grats, for an explanation of how to think about generics and practical examples of how to use them, see our [Generics Guide](../05-guides/07-generics.mdx)._

---

Generally in Grats, types used as field members and types must either be scalar types, or type references which resolve to declarations explicitly marked with an `@gql*` docblock tag. However, there are some cases where it is useful to use types in a more flexible, or "generic" way.

In Grats, the types used for fields and members of unions are also allowed to reference an additional type of declaration: the type parameters of the parent declaration itself.

When a `@gql*` type declaration contains references to its type parameters in positions that will be interpreted as GraphQL types, the declaration becomes a _generic template_. In other words, the declaration will _not itself be added to the schema_, but will be used as a template. When this TypeScript type is referenced in a GraphQL position, it's GraphQL type parameters will then be interpolated into the generic template, and the resulting type will be added to the schema.

## Examples

```typescript
/** @gqlType */
type Edge<T> = {
  node: T;
  cursor: string;
};

/** @gqlUnion */
type Result<T> = T | GqlError;
```

## Type Parameters

A `@gql*` may freely make use to type parameters and by default they will simply be ignored by Grats. However, if one of those type parameters is used in a position that will be interpreted by Grats as a GraphQL type, the declaration will be treated as a generic template.

When the generic type is then itself used in a position that will be interpreted as a GraphQL type, the type parameters that were referenced in GraphQL positions must be provided as type arguments, and must themselves be `@gql*` types (or type parameters of the containing declaration).

## Naming

When a generic type is materialized, its name wll be constructed by concatenating the names of each of its GraphQL type parameters (in order), followed by the name of the generic template type.

For example:

- `Result<Upload>` — `UploadResult`
- `Connection<User>` — `UserConnection`
- `Review<User, Product>` — `UserProductReview`

Each name will only be added to the schema once, even if it is used in multiple places.

:::note
The description and `@deprecated` marking on the generic type will be inherited by each of the materialized types.
:::

## Nesting

There are two different ways that generics can nest:

A type parameter of a declaration can be passed as a type argument to another generic type.

```typescript
/** @gqlType */
type Connection<T> = {
  edges: Edge<T>[];
  pageInfo: PageInfo;
};
```

A generic type can be passed a type argument which is itself a generic type with its own type arguments.

```typescript
/** @gqlType */
type User = {
  reviews: Result<Connection<Review>>;
};
```

## Limitations

There are some limitations to how generics can be used in Grats:

### Only unadorned type names may be passed as GraphQL type parameters

You may not pass scalars, arrays, or unions as type parameters. This helps ensure Grats can derive a sensible name for each materialized type.

### Parameterized types may not implement interfaces or be members of unions

For a type to be part of an abstract type, the executor must be able to determine its concrete type at runtime. Grats enforces this by requiring all types that are part of an abstract type to explicitly define a `__typename` field as a const string literal matching the type's name. This is not possible for parameterized types, so they may not be part of abstract types.

In the future we may find ways to lift or relax these restrictions, so if you have a legitimate use case that is blocked by these limitations, please let us know by [opening an issue](https://github.com/captbaritone/grats/issues/new).
