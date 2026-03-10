# Renaming

In some cases the name of your TypeScript construct might not match the name you want to use in your GraphQL schema. For example, you might want to use a more descriptive name in your GraphQL schema, or you might want to use a different casing style.

Grats enables this by allowing you to specify a name for your construct immediately following the `@gql*` docblock tag for the construct.

## Example

In this example, the TypeScript class representing our user is called `UserModel`, but we want to use `User` in our GraphQL schema

```tsx
/** @gqlType User */
export class UserModel {
  /** @gqlField */
  name: string;
}
```

And here we want to expose the `getGreeting()` method as a field named `greeting`.

```tsx
/** @gqlType */
export class User {
  name: string;

  /** @gqlField greeting */
  getGreeting(): string {
    return `Hello, ${this.name}`;
  }
}
```
