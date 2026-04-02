# Generics

_This page is a guide explaining the principles of generic types and showing practical examples of how you might use them. For formal documentation about how generics are supported in Grats see [Generics](../resolvers/generics.md)._

* * *

Generic types allow you types which can be parameterized by other types. This is useful for creating reusable types. In GraphQL the list type can be thought of as a generic type, in that you can construct a list of type `T` for any `T` without needing to define a explicit new named type.

Unfortunately, GraphQL does not currently have support for user-defined generic types.

However, since Grats derives your GraphQL schema, it is able to support generic types. In fact, Grats supports defining types, interfaces, unions and input types with generics. When you use a generic type with a parameter, Grats will materialize a concrete representation of the type in your generated schema.

## Example 1: Result Type

Lets consider a common pain point: You have a field which you know will error sometimes, and you'd like to ensure your consumers consider this case by modeling it in your schema.

A manual implementation might look like:

TypeScriptGraphQL

```tsx
/** @gqlUnion */
export type MyValueResult = MyValue | MyError;

/** @gqlQueryField */
export function myValue(): MyValueResult {
  try {
    return getMyValue();
  } catch (e) {
    return { message: e.message, __typename: "MyError" };
  }
}

/** @gqlType */
export type MyValue = {
  __typename: "MyValue";
  /** @gqlField */
  value: string;
};

/** @gqlType */
export type MyError = {
  __typename: "MyError";
  /** @gqlField */
  message: string;
};

function getMyValue(): MyValue {
  return { value: "Hello, World!", __typename: "MyValue" };
}
```

But if we want to have many fields like this, we'd have to manually define a `*Result` type for each type of value we want to return. Let's define a generic `Result<T>` type which is reusable to make this more streamlined.

TypeScriptGraphQL

```tsx
/** @gqlUnion */
export type Result<T> = T | MyError;

/** @gqlQueryField */
export function myValue(): Result<MyValue> {
  try {
    return getMyValue();
  } catch (e) {
    return { message: e.message, __typename: "MyError" };
  }
}

/** @gqlQueryField */
export function myOtherValue(): Result<MyOtherValue> {
  try {
    return getMyOtherValue();
  } catch (e) {
    return { message: e.message, __typename: "MyError" };
  }
}

/** @gqlType */
export type MyValue = {
  __typename: "MyValue";
  /** @gqlField */
  value: string;
};

/** @gqlType */
export type MyOtherValue = {
  __typename: "MyOtherValue";
  /** @gqlField */
  value: string;
};

/** @gqlType */
export type MyError = {
  __typename: "MyError";
  /** @gqlField */
  message: string;
};

function getMyValue(): MyValue {
  return { value: "Hello, World!", __typename: "MyValue" };
}

function getMyOtherValue(): MyOtherValue {
  return { value: "Hello, World!", __typename: "MyOtherValue" };
}
```

You can use the toggle above each example to inspect the generated schema and see the types which Grats generates from this code.

## Example 2: Connection Type

Another common idiom in GraphQL which lends itself well to generics is the `Connection` type. This is a type which represents a paginated list of items. It is often used in GraphQL APIs to represent lists of items which are too large to return in a single response.

An example of how you might define a spec-compatible `Connection` type using generics can be found in the [Connection Spec](./connection-spec.md) guide.

## Further Reading

To read more about Generics in TypeScript, see the section on [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html) in the TypeScript Handbook.

The excellent implementation-fist Python GraphQL library [Strawberry](https://strawberry.rocks/) supports [deriving schema from generics](https://strawberry.rocks/docs/types/generics) in Python. This provided significant inspiration for Grats' implementation.
