# Why Use Comments?

Depending upon the capabilities of the target language, there are a number of ways to implement an [implementation-first](https://jordaneldredge.com/blog/implementation-first/) GraphQL server like Grats. Some libraries use [introspection](https://strawberry.rocks) while others use [macros](https://github.com/graphql-rust/juniper). _So why does Grats choose to use comments instead?_ Let's explore why these other approaches are not a good fit for TypeScript and Grats.

## Why not use decorators?

Other tools, like [Strawberry](https://strawberry.rocks) for Python, use decorators to annotate types and fields. I think this is probably the ideal API for an implementation-first GraphQL server. It uses existing language syntax and, via introspection, can derive the GraphQL schema at runtime without requiring an additional build step.

However, there ara a few reasons why it's not feasible in TypeScript. Firstly, because decorators are runtime constructs, they cannot be attached to types, which would prevent things like defining GraphQL input/output types with TypeScript `type`s.

Secondly, TypeScript types are stripped at runtime so it is fundamentally impossible to use introspection to "see" the types of fields/arguments etc. This means that introspection cannot be used to derive a GraphQL schema from TypeScript types at runtime. If we want to use type annotations to derive GraphQL types, we must use do so statically/at build time.

That said, introspection can be used to derived _pieces_ of a GraphQL schema. For example, names of type/class decorations and field names. [TypeGraphQL](https://typegraphql.com/) is a library that is similar to Grats in many ways, but uses decorators and introspection instead of comments. However, since types are not visible at runtime, it ends up needing to fall back to a builder-like API to express things like field return types, and argument types. This tradeoff has the advantage of avoiding a build step, but at the cost of a more complex API.

For Grats, we wanted to optimize for the simplest possible API.

## Why not use macros?

TypeScript does not currently support macros, and seems [unlikely to add them](https://github.com/microsoft/TypeScript/issues/4892#issuecomment-1775804502).

## Then why comments?

Given the limitations faced when trying to support an implementation-first API in TypeScript, Grats falls back to a lowest common denominator: static analysis. Grats infers GraphQL types from TypeScript at build time by _analyzing_ the code rather than _running_ it.

We chose doc-blocks because they accurately convey that the code within them does not impact the runtime, while still having a well defined structure that can be parsed. In particular, we're able to leverage the TypeScript compiler's JSDoc parsing, which aligns well with our design principle of ["A few dependencies well leveraged"](./06-design-principles.md#a-few-dependencies-well-leveraged).

## Summary

Ideally Grats would be able to leverage either introspection or macros to derive a GraphQL schema. These are both very nice approaches to implementation-first GraphQL. However, the limitations of TypeScript preclude these options. Instead, Grats resorts to static analysis to infer a GraphQL schema from TypeScript types, and doc-blocks strike a nice balance of being structured enough to be machine readable, while clearly communicating that they are not part of the runtime.
