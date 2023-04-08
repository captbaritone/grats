# Limitations of Grats

Grats has some known limitations. Some are innate, some have the possibility of
being resolved with effort. In the interest of transparency, I wanted to
document them here.

## Method wrappers

Sometimes it can be useful to wrap a method in a function. This can emulate the
behavior of of a decorator. For example:

```typescript
class User {
  approve_post = requireAuthed(({ id }: { id: ID }) => {
    Post.approve(id);
    return true;
  });
}
```

Currently Grats cannot handle this because it's not able to "see" what type the
wrapper function will return, or what arguments the returned function will accept.

## Inferred types

In thory Grats could ask TypeScript what type it's inferring for a given
locaiton. For example, in the following function, TypeScript would _infer_ that
it returns `string`, so we shouldn't need to explicitly annotate the return
type.

```typescript
/** @gqlField */
export function name(_: User) {
  return "John";
}
```

It's possible that a future version of Grats will explore this.
Perhaps if [this TypeScript pull
request](https://github.com/microsoft/TypeScript/issues/9879) is merged.

## Descriptions and @deprecated on TypeScript union @gqlEnums

Currently Grats does not support descriptions or `@deprecated` on GraphQL enum
values when the enum is defined as a TypeScript union.

```typescript
/** @gqlEnum */
type MyEnum = 
  /** This gets ignored */
  "A" | 
  /** So does this */
  "B";
```

This is because we rely on the TypeScript compiler to tell us which docblocsk
are "attached" to a given AST node, and TypeScript doesn't see those comments as
attached to anything. In the future we could explore implementing our own
comment attachment, but it is a difficult problem.

## Alternate comment types

It would be nice if Grats supported other comment types, such as regular block
comments (with one *) or inline comments (starting with two slashes). However we
can't currently.

This is because we rely on the TypeScript compiler to tell us which docblocsk
are "attached" to a given AST node, and TypeScript doesn't see those comments as
attached to anything. In the future we could explore implementing our own
comment attachment, but it is a difficult problem.



