# Interfaces

GraphQL interfaces can be defined by placing a `@gqlInterface` docblock directly before an:

* Interface declaration

```ts
/**
 * A description of my interface.
 * @gqlInterface <optional name of the type, if different from class name>
 */
interface MyClass {
  /** @gqlField */
  someField: string;
}
```

All `@gqlType` types which implement the interface in TypeScript will
automatically implement it in GraphQL as well.

**Note**: Types declared using type literals `type MyType = { ... }` cannot yet
implement interfaces. For now, you must use a class declarations for types which
implement interfaces.
