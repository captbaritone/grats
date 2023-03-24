# -=[  EXPERIMENTAL PRE ALPHA ]=-

**This is currently a proof of concept. It won't yet work on any real projects.**

# Grats: True code-first GraphQL for TypeScript

Grats is a tool for statically infering GraphQL schema from your vanilla
TypeScript code.

Just write your types and resolvers as regular TypeScript and annotate your
types and fields with simple JSDoc tags. From there, Grats can extract your
GraphQL schema automatically by statically analyzing your code and its types. No
convoluted directive APIs to remember. No need to define your Schema at
runtime with verbose builder APIs. 

By making your TypeScript implementation the source of truth, you entirely
remove the question of mismatches between your implementation and your GraphQL schema definition. Your implementation _is_ the schema definition!

## Example

```ts
/** @GQLType */
export default class Query {
  /** @GQLField */
  me(): UserResolver {
    return new UserResolver();
  }
  /** 
   * @GQLField
   * @deprecated Please use `me` instead.
   */
  viewer(): UserResolver {
    return new UserResolver();
  }
}

/**
 * A user in our kick-ass system!
 * @GQLType User
 */
class UserResolver {
  /** @GQLField */
  name: string = 'Alice';

  /** @GQLField */
  greeting(args: { salutation: string }): string {
    return `${args.salutation}, ${this.name}`;
  }
}
```

Extracts the following GraphQL schema:

```graphql
type Query {
  me: User
  viewer: User @deprecated(reason: "Please use `me` instead.")
}

"""A user in our kick-ass system!"""
type User {
  name: String
  greeting(salutation: String!): String
}
```

**Give it a try in the [online playground](https://capt.dev/grats-example)!**

## CLI Usage

Still very rough, but you can try it out with:

*Note:* Globs will be evaluated relative to the current working directory.

```bash
git clone ...
pnpm install
pnpm cli <glob of files to analyze>

# Example: `pnpm cli "example-server/**/*.ts"`
```

## API Usage

In order for Grats to extract GraphQL schema from your code, simply mark which
classes and methods should be included in the schema by marking them with
special JSDoc tags such as `/** @GQLType */` or `/** @GQLField */`.

Any comment text preceding the JSDoc `@` tag will be used as that element's description.

**Note that JSDocs must being with
`/**` (two asterix).** However, they may be consolidated into a single line.

The following JSDoc tags are supported:

* [`@GQLType`](#GQLtype)
* [`@GQLInterface`](#GQLinterface)
* [`@GQLField`](#GQLfield)
* [`@GQLUnion`](#GQLunion)
* [`@GQLScalar`](#GQLscalar)
* [`@GQLEnum`](#GQLenum)
* [`@GQLInput`](#GQLinput)


### @GQLType

GraphQL types can be defined by placing a `@GQLType` docblock directly before a:

* Class declaration

```ts
/**
 * Here I can write a description of my type that will be included in the schema.
 * @GQLType <optional name of the type, if different from class name>
 */
class MyClass {
  /** @GQLField */
  someField: string;
}
```

* Interface declaration

```ts
/**
 * Here I can write a description of my type that will be included in the schema.
 * @GQLType <optional name of the type, if different from interface name>
 */
interface MyInterface {
  /** @GQLField */
  someField: string;
}
```

### @GQLInterface

GraphQL interfaces can be defined by placing a `@GQLInterface` docblock directly before an:

* Interface declaration

```ts
/**
 * A description of my interface.
 * @GQLInterface <optional name of the type, if different from class name>
 */
interface MyClass {
  /** @GQLField */
  someField: string;
}
```

All `@GQLType` types which implement the interface in TypeScript will
automatically implement it in GraphQL as well.

### @GQLField

Within a `@GQLType` class, you can define GraphQL fields by placing a `@GQLField` directly before a:

* Method declaration
* Property declaration
* Property signature

```ts
/**
 * A description of some field.
 * @GQLField <optional name of the field, if different from property name>
 */
someField: string;

/**
 * A description of my field.
 * @GQLField <optional name of the field, if different from method name>
 */
myField(): string {
  return "Hello World";
}
```

**Note**: By default, Grats makes all fields nullable in keeping with [GraphQL
*best practices](https://graphql.org/learn/best-practices/#nullability). This behavior can be changed by setting config option `nullableByDefault` to `true`.

If you wish to define arguments for a field, define your argument types inline:

```ts
/** @GQLField */
myField(args: { greeting: string }): string {
  return `${args.greeting} World`;
}
```

Default values for arguments can be defined by using the `=` operator with destructuring:

```ts
/** @GQLField */
myField({ greeting = "Hello" }: { greeting: string }): string {
  return `${greeting} World`;
}
```

Arguments can be given descriptions by using the `/**` syntax:

```ts
/** @GQLField */
myField(args: { 
  /** A description of the greeting argument */
  greeting: string
}): string {
  return `${args.greeting} World`;
}
```

To mark a field as deprecated, use the `@deprecated` JSDoc tag:

```ts
/** 
 * @GQLField
 * @deprecated Please use myNewField instead.
 */
myOldField(): string {
  return "Hello World";
}
```

### @GQLUnion

GraphQL unions can be defined by placing a `@GQLUnion` docblock directly before a:

* Type alias of a union of object types

```ts
/** 
 * A description of my union.
 * @GQLUnion <optional name of the union, if different from type name>
 */
type MyUnion = User | Post;
```

### @GQLScalar

GraphQL custom sclars can be defined by placing a `@GQLScalar` docblock directly before a:

* Type alias declaration

```ts
/** 
 * A description of my custom scalar.
 * @GQLScalar <optional name of the scalar, if different from type name>
 */
type MyCustomString = string;
```

### @GQLEnum

GraphQL enums can be defined by placing a `@GQLEnum` docblock directly before a:

* TypeScript enum declaration
* Type alias of a union of string literals

```ts
/** 
 * A description of my enum.
 * @GQLEnum <optional name of the enum, if different from type name>
 */
enum MyEnum {
  /** A description of my variant */
  OK = "OK"
  /** A description of my other variant */
  ERROR = "ERROR"
}
```

Note that the values of the enum are used as the GraphQL enum values, and must
be string literals.

To mark a variants as deprecated, use the `@deprecated` JSDoc tag directly before it:

```ts
/** @GQLEnum */
enum MyEnum {
  OK = "OK"
  /** @deprecated Please use OK instead. */
  OKAY = "OKAY"
  ERROR = "ERROR"
}
```

We also support defining enums using a union of string literals, howerver there
are some limitations to this approach:

* You cannot add descriptions to enum values
* You cannot mark enum values as deprecated

This is due to the fact that TypeScript does not see JSDoc comments as
"attaching" to string literal types.

```ts
/** 
 * A description of my enum.
 * @GQLEnum <optional name of the enum, if different from type name>
 */
type MyEnum = "OK" | "ERROR";
```

### @GQLInput

GraphQL input types can be defined by placing a `@GQLInput` docblock directly before a:

* Type alias declaration

```ts
/** 
 * Description of my input type
 * @GQLInput <optional name of the input, if different from type name>
 */
type MyInput = {
  name: string;
  age: number;
};
```

## Example

See `example-server/` in the repo root for a working example. Here we run the static
analysis at startup time. Nice for development, but not ideal for production
where you would want to cache the schema and write it to disk for other tools to
see.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) in the repo root for details on how to make changes to this project.

# FAQ

## Why would I _not_ want to use Grats

Because Grats relies on static analysis to infer types, it requires that your
GraphQL fields use types that can be statically analyzed.  This means that you
can't use complex derived types in positions where Grats needs to be able to
infer the type. For example, field arguments and return values. 

Currently, Grats does not have a great way to handle the case where you want to
expose structures that are not owned by your codebase. For example, if you want
to expose a field that returns a type from a third-party library, or a type that
is generated by some other codegen tool. Today, your best option is to define a
wrapper resolver class.

## Why use comments and not decorators?

Using decorators to signal that a class/method/etc should be included in the 
schema would have some advantages:

* The syntax is well defined, so it:
  * Can be checked/documented by TypeScript types
  * Formatted with tools like Prettier
* Would not require custom parsing/validaiton rules

However, it also has some disadvantages:

* The feature is technically "experimental" in TypeScript and may change in the future.
* Decorators cannot be applied to types, so it would precude the ability to
  define GraphQL constructs using types (e.g. interfaces, unions, etc).
* Decorators cannot be applied to parameters, so it would preclude the ability
  to define GraphQL constructs using parameters (e.g. field arguments).
* Decorators are a runtime construct, which means they must be imported and give
  the impression that they might have some runtime behavior. This is not the
  case for Grats, which is purely a static analysis tool.

Given these tradeoffs, we've decided to use comments instead of decorators.

# Acknowledgements

* @mofeiZ and @alunyov for their Relay hack-week project exploring a similar idea.
* @josephsavona for input on the design of [Relay Resolvers](https://relay.dev/docs/guides/relay-resolvers/) which inspired this project.
* @bradzacher for tips on how to handle TypeScript ASTs.
* Everyone who worked on Meta's Hack GraphQL server, the developer experince of which inspired this project.
* A number of other projects which seem to have explored similar ideas in the past:
  * [ts2gql](https://github.com/convoyinc/ts2gql)
  * [ts2graphql](https://github.com/cevek/ts2graphql)
  * [typegraphql-reflection-poc](https://github.com/MichalLytek/typegraphql-reflection-poc)