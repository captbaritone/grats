# Enums

GraphQL enums can be defined by placing a `@gqlEnum` docblock directly before a:

-   TypeScript enum declaration
-   Type alias of a union of string literals
-   Type alias deriving from a const array (`(typeof X)[number]`) or const object (`(typeof X)[keyof typeof X]`)

```tsx
/**
 * A description of my enum.
 * @gqlEnum
 */
enum MyEnum {
  /** A description of my variant */
  OK = "OK",
  /** A description of my other variant */
  ERROR = "ERROR",
}
```

_Generated GraphQL schema:_

```graphql
"""A description of my enum."""
enum MyEnum {
  """A description of my other variant"""
  ERROR
  """A description of my variant"""
  OK
}
```

Note that the values of the enum are used as the GraphQL enum values, and must be string literals.

To mark a variant as deprecated, use the `@deprecated` JSDoc tag directly before it:

```tsx
/** @gqlEnum */
enum MyEnum {
  OK = "OK",
  /** @deprecated Please use OK instead. */
  OKAY = "OKAY",
  ERROR = "ERROR",
}
```

_Generated GraphQL schema:_

```graphql
enum MyEnum {
  ERROR
  OK
  OKAY @deprecated(reason: "Please use OK instead.")
}
```

Enums can also be defined using a union of string literals. A docblock before each member works the same way:

```tsx
/** @gqlEnum */
type MyEnum =
  /** The request succeeded. */
  | "OK"
  /** @deprecated Please use OK instead. */
  | "OKAY"
  | "ERROR";
```

_Generated GraphQL schema:_

```graphql
enum MyEnum {
  ERROR
  """The request succeeded."""
  OK
  OKAY @deprecated(reason: "Please use OK instead.")
}
```

## Runtime-accessible enums

If you need runtime access to enum values without using TypeScript's `enum` syntax, Grats supports deriving enums from const arrays and const objects.

> **INFO:**
> The const declaration must use `as const` and must be the statement immediately preceding the `@gqlEnum` type alias. This ensures the actual list of enum values is colocated with the `@gqlEnum` annotation.

### Const array

```tsx
const ALL_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

/** @gqlEnum */
type Status = (typeof ALL_STATUSES)[number];
```

_Generated GraphQL schema:_

```graphql
enum Status {
  ARCHIVED
  DRAFT
  PUBLISHED
}
```

### Const object

Const objects allow you to define human-readable keys that map to GraphQL enum values, similar to TypeScript `enum` declarations:

```tsx
const Status = {
  /** Currently being edited */
  Draft: "DRAFT",
  /** Available to readers */
  Published: "PUBLISHED",
  /** @deprecated Use DRAFT instead */
  Hidden: "HIDDEN",
} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];
```

_Generated GraphQL schema:_

```graphql
enum Status {
  """Currently being edited"""
  DRAFT
  HIDDEN @deprecated(reason: "Use DRAFT instead")
  """Available to readers"""
  PUBLISHED
}
```
