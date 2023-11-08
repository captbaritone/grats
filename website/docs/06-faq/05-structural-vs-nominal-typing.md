# Structural vs Nominal Typing

Type systems can be classified into two categories: _structural_ and _nominal_. In a structural type system, types are considered equivalent if they have the same _structure_ or _shape_. In a nominal type system, types are considered equivalent if they have the same _name_. For example:

- **TypeScript** is structurally typed
- **GraphQL** is a nominally typed

This misalignment presents a challenge for us in Grats where we are trying to allow you to use _structural_ TypeScript constructs to express _nominal_ GraphQL types.

To illustrate the problem, consider the following example:

```typescript
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Post = {
  /** @gqlField */
  // highlight-start
  author: { name: string };
  // highlight-end
};
```

In TypeScript, `Post.author` is a valid `User` since the type literal `{ name: string }` has the same _structure_ as the `User` type. But, in order to construct the GraphQL definition for `Post` we need to know the _name_ of `Post.author`'s type.

## Grats' solution

In grats we get around this by enforcing that any type annotation that Grats needs to infer as a GraphQL type _must be a direct reference to a declaration_. That declaration can be a type alias, interface, or class, but it must be a declaration. If you don't do this, Grats will report a, hopefully helpful, error.

To correct the above error, we might write:

```typescript
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Post = {
  /** @gqlField */
  // highlight-start
  author: User;
  // highlight-end
};
```

When Grats is inferring the type of `Post.author` it asks TypeScript to locate the _declaration_ of the type `User`, which is the declaration where the type `User` is defined. From that, Grats can "see" the `@gqlType` tag and know exactly which _nominal_ GraphQL type is being referenced.

Coincidentally, this ends up working out well, since the TypeScript library does not yet expose the ability to check if two types are type compatible as far as TypeScript is concerned (i.e. structurally equivalent) but it _does_ expose the ability find the declaration of a type.

## Limitations imposed

As a user of Grats, this means there are some things which might feel intuitive to write in TypeScript which Grats will not be able to understand. **Grats knows about these cases and tries to report helpful errors when it encounters them.**

For example, this means you cannot use intermediate type aliases, since the _definition_ of the `Admin` type is not annotated as a GraphQL type.

```typescript
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

// highlight-start
type Admin = User;
// highlight-end

/** @gqlType */
type Post = {
  /** @gqlField */
  // highlight-start
  author: Admin; // <-- Grats cannot infer the name of this type
  // highlight-end
};
```

## Capabilities enabled

While this approach does impose some limitations, it also enables some other patterns. For example,
