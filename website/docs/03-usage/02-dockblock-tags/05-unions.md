# Unions

GraphQL unions can be defined by placing a `@gqlUnion` docblock directly before a:

* Type alias of a union of object types

```ts
/** 
 * A description of my union.
 * @gqlUnion <optional name of the union, if different from type name>
 */
type MyUnion = User | Post;
```
