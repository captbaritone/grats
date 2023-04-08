# Why Use Comments?

Other [similar projects](https://typegraphql.com/) use decorators to define
GraphQL constructs. Why doesn't Grats?

* Decorators cannot be applied to types, so it would precude the ability to
  define GraphQL constructs using types (e.g. interfaces, unions, etc).
* Decorators cannot be applied to parameters, so it would preclude the ability
  to define GraphQL constructs using parameters (e.g. field arguments).
* Decorators are a runtime construct, which means they must be imported and give
  the impression that they might have some runtime behavior. This is not the
  case for Grats, which is purely a static analysis tool.

Given these tradeoffs, we've decided to use comments instead of decorators.