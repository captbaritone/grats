# user_error/NoTypesDefined.invalid.ts

## Input

```ts title="user_error/NoTypesDefined.invalid.ts"
// A project without any GraphQL types gets a message about how to define one.
export const greeting = "Hello";
```

## Output

### Error Report

```text
error: Grats could not find any GraphQL types defined in this project.

Declare a type by adding a `/** @gqlType */` docblock above a class, interface, or type alias declaration.
Grats looks for docblock tags in any TypeScript file included in your TypeScript project.
```