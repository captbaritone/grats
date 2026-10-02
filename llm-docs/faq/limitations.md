# Limitations of Grats

Grats has some known limitations. Some are innate, some have the possibility of being resolved with effort. In the interest of transparency, I wanted to document them here.

## Method wrappers

Sometimes it can be useful to wrap a method in a function. This can emulate the behavior of a decorator. For example:

```typescript
class User {
  approve_post = requireAuthed(({ id }: { id: ID }) => {
    Post.approve(id);
    return true;
  });
}
```

Currently Grats cannot handle this because it's not able to "see" what type the wrapper function will return, or what arguments the returned function will accept. Grats analyzes your code's syntax rather than running TypeScript's type checker, so it can only see types which are written out explicitly.

## Inferred types

In the following function, TypeScript would _infer_ that it returns `string`, so in theory we shouldn't need to explicitly annotate the return type.

```typescript
/** @gqlField */
export function name(_: User) {
  return "John";
}
```

However, Grats does not run TypeScript's type checker, so it has no way to know what type TypeScript would infer. Grats requires the type to be written out explicitly.

Even if Grats could ask TypeScript, inferred types end up not being a good fit for GraphQL's type system, since GraphQL is "nominal" rather than "structural" like TypeScript. See [Structural vs Nominal Typing](./structural-vs-nominal-typing.md) for more details.

## Alternate comment types

It would be nice if Grats supported other comment types, such as regular block comments (with one *) or inline comments (starting with two slashes). However we can't currently. Instead, Grats reports an error if it finds a Grats tag in one of these comments.

This is because Grats follows TypeScript's rules for which docblocks are "attached" to a given AST node, and under those rules only JSDoc-style `/** */` comments can be attached to anything.
