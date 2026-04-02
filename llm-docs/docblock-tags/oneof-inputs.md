# OneOf Input

OneOf input types are an experimental GraphQL feature, currently a [draft stage RFC](https://github.com/graphql/graphql-spec/pull/825), which lets you define an input type where exactly one of the fields must be provided. This can be useful for modeling structures similar to [unions](./unions.md) but for input types.

OneOf inputs can be defined by placing both `@gqlInput` in a docblock directly before a:

-   Type alias of a union of object literal types

The union must be a union of object types, and each object type must have exactly one property whose value is a valid [input type](./inputs.md). You can think of each member of the union as modeling one of the possible values the user might provide as a valid input.

You _do not_ need to use [`@gqlAnnotate`](./directive-annotations.md) to add the `@oneOf` directive to your input type. Grats will automatically add this directive for you.

> **WARNING:**
> OneOf is not supported in versions of graphql-js earlier than `v16.9.0`. If you are using an older version of graphql-js, you will need to upgrade to use this feature.

TypeScriptGraphQL

```tsx
/**
 * @gqlInput
 */
export type UserBy = { email: string } | { username: string };
```

## OneOf input field descriptions

TypeScript does not support docblocks "attach" to a member of a union. Therefore, if you want to provide a description for a field of a OneOf input, place it above the field, within the object literal:

TypeScriptGraphQL

```tsx
/**
 * @gqlInput
 */
export type UserBy =
  | {
      /** Fetch the user by email */
      email: string;
    }
  | {
      /** Fetch the user by username */
      username: string;
    };
```

## Working with OneOf inputs

When handling one of these types in TypeScript it is a best practice to use an exhaustive switch. This way, if you add a new option to the union, TypeScript will trigger an error in all the locations where you handle the union.

_As of TypeScript 5.3.0_, TypeScript supports a pattern called [Switch True Narrowing](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-3.html#switch-true-narrowing) which can be used to ensure that you have handled all the possible options in this type of union. It looks like this:

TypeScriptGraphQL

```tsx
/**
 * @gqlInput
 */
export type UserBy = { email: string } | { username: string };

/** @gqlQueryField */
export function getUser(by: UserBy): User {
  switch (true) {
    case "email" in by:
      return User.fromEmail(by.email);
    case "username" in by:
      return User.fromUsername(by.username);
    default: {
      // This line will error if an unhandled option is added to the union
      const _exhaustive: never = by;
      throw new Error(`Unhandled case: ${JSON.stringify(by)}`);
    }
  }
}

/** @gqlType */
class User {
  constructor(
    /** @gqlField */
    public email?: string,
    /** @gqlField */
    public username?: string,
  ) {}

  static fromEmail(email: string): User {
    return new User(email, undefined);
  }

  static fromUsername(username: string): User {
    return new User(undefined, username);
  }
}
```

> **NOTE:**
> Grats is open to supporting other syntaxes for defining OneOf inputs. If you have a syntax that you find more intuitive, please [open an issue](https://github.com/captbaritone/grats/issues/new).
