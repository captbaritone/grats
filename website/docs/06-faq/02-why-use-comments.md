# Why Use Comments?

Other similar projects use [introspection](https://strawberry.rocks) or [macros](https://github.com/graphql-rust/juniper) or [decorators](https://typegraphql.com/) to define GraphQL constructs. Why does Grats choose to use comments instead?

## Introspection

Because TypeScript types are stripped at runtime, it's fundamentally impossible to use introspection to "see" the types of fields.

## Macros

TypeScript does not currently support macros.

## Decorators

- Decorators cannot be applied to types, so it would preclude the ability to
  define GraphQL constructs using types (e.g. interfaces, unions, etc).
- Decorators cannot be applied to parameters, so it would preclude the ability
  to define GraphQL constructs using parameters (e.g. field arguments).
- Decorators are a runtime construct, which means they must be imported and give
  the impression that they might have some runtime behavior. This is not the
  case for Grats, which is purely a static analysis tool.

Given these tradeoffs, we've decided to use comments instead of decorators.
