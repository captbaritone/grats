# -=[  EXPERIMENTAL PRE ALPHA ]=-

**This is currently a proof of concept. It won't yet work on any real projects.**

# Grats: Implementation-First GraphQL for TypeScript

[![Join our Discord!](https://img.shields.io/discord/1089650710796320868?logo=discord)](https://capt.dev/grats-chat)

Grats is a tool for statically infering GraphQL schema from your vanilla
TypeScript code.

Just write your types and resolvers as regular TypeScript and annotate your
types and fields with simple JSDoc tags. From there, Grats can extract your
GraphQL schema automatically by statically analyzing your code and its types. No
convoluted directive APIs to remember. No need to define your Schema at
runtime with verbose builder APIs. 

By making your TypeScript implementation the source of truth, you entirely
remove the question of mismatches between your implementation and your GraphQL
schema definition. Your implementation _is_ the schema definition!

## Examples

Grats is flexible enough to work with both class-based and functional
approaches to authoring GraphQL types and resolvers.

### Class-Based

```ts
/** @gqlType */
export default class Query {
  /** @gqlField */
  me(): User {
    return new User();
  }
  /** 
   * @gqlField
   * @deprecated Please use `me` instead.
   */
  viewer(): User {
    return new User();
  }
}

/**
 * A user in our kick-ass system!
 * @gqlType
 */
class User {
  /** @gqlField */
  name: string = 'Alice';

  /** @gqlField */
  greeting(args: { salutation: string }): string {
    return `${args.salutation}, ${this.name}`;
  }
}
```

### Functional

```ts
/** @gqlType */
export type Query {};

/** @gqlField */
export function me(_: Query): User {
  return { name: "Alice" };
}

/** 
 * @gqlField
 * @deprecated Please use `me` instead.
 */
export function viewer(_: Query): User {
  return { name: "Alice" };
}

/**
 * A user in our kick-ass system!
 * @gqlType
 */
type User = {
  /** @gqlField */
  name: string;
}


/** @gqlField */
export function greeting(user: User, args: { salutation: string }): string {
  return `${args.salutation}, ${user.name}`;
}
```

Both of the above examples extract the following GraphQL schema:

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

**Give it a try in the [online playground](https://capt.dev/grats-sandbox)!**

## Quick Start

For dev mode or small projects, Grats offers a runtime extraction mode. This is
the easiest way to get started with Grats, although you may find that it causes
a slow startup time. For larger projects, you probably want to use the build
mode (documentation to come).

```sh
npm install express express-graphql grats
```

**Ensure your project has a `tsconfig.json` file.**

```ts
import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import { extractGratsSchemaAtRuntime } from "grats";

/** @gqlType */
class Query {
  /** @gqlField */
  hello(): string {
    return "Hello world!";
  }
}

const app = express();

// At runtime Grats will parse your TypeScript project (including this file!) and
// extract the GraphQL schema.
const schema = extractGratsSchemaAtRuntime({
  emitSchemaFile: "./schema.graphql",
});

app.use(
  "/graphql",
  graphqlHTTP({ schema, rootValue: new Query(), graphiql: true }),
);
app.listen(4000);
console.log("Running a GraphQL API server at http://localhost:4000/graphql");
```

Try it out on [CodeSandbox](https://capt.dev/grats-sandbox)!

## Configuration

Grats has a few configuration options. They can be set in your project's
`tsconfig.json` file:

```json5
{
  "grats": {
    // Should all fields be typed as nullable in accordance with GraphQL best
    // practices?
    // https://graphql.org/learn/best-practices/#nullability
    // 
    // Individual fileds can declare themselves as nonnullable by adding the
    // docblock tag `@killsParentOnException`.
    "nullableByDefault": true, // Default: true

    // Should Grats error if it encounters a TypeScript type error?
    // Note that Grats will always error if it encounters a TypeScript syntax
    // error.
    "reportTypeScriptTypeErrors": false, // Default: false
  },
  "compilerOptions": {
    // ... TypeScript config...
  }
}
```

## API Usage

In order for Grats to extract GraphQL schema from your code, simply mark which
TypeScript structures should be included in the schema by marking them with
special JSDoc tags such as `/** @gqlType */` or `/** @gqlField */`.

Any comment text preceding the JSDoc `@` tag will be used as that element's description.

**Note that JSDocs must being with `/**` (two asterix).** However, they may be consolidated into a single line.

The following JSDoc tags are supported:

* [`@gqlType`](#gqltype)
* [`@gqlInterface`](#gqlinterface)
* [`@gqlField`](#gqlfield)
* [`@gqlUnion`](#gqlunion)
* [`@gqlScalar`](#gqlscalar)
* [`@gqlEnum`](#gqlenum)
* [`@gqlInput`](#gqlinput)

Each tag maps directly to a concept in the GraphQL [Schema Definition
Language](https://graphql.org/learn/schema/) (SDL). The documentation below aims
to be complete, but our hope is that you feel empowered to just slap one of
these docblock tags on the relevent TypeScript class/type/method/etc in your
code, and let Grats' helpful error messages guide you.

### @gqlType

GraphQL types can be defined by placing a `@gqlType` docblock directly before a:

* Class declaration
* Interface declaration
* Type alias of a literal type

```ts
/**
 * Here I can write a description of my type that will be included in the schema.
 * @gqlType <optional name of the type, if different from class name>
 */
class MyClass {
  /** @gqlField */
  someField: string;
}
```

```ts
/** @gqlType */
interface MyType {
  /** @gqlField */
  someField: string;
}
```

```ts
/** @gqlType */
type MyType = {
  /** @gqlField */
  someField: string;
}
```

Note: If your type implements a GraphQL interface or is a member of a GraphQL
union, Grats will remind you to add a `__typename: "MyType"` property to your
class or interface.

### @gqlInterface

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

### @gqlField

You can define GraphQL fields by placing a `@gqlField` directly before a:

* Method declaration
* Method signature
* Property declaration
* Property signature
* Function declaration (with named export)

```ts
/**
 * A description of some field.
 * @gqlField <optional name of the field, if different from property name>
 */
someField: string;

/** @gqlField */
myField(): string {
  return "Hello World";
}
```

#### Field nullability

**Note**: By default, Grats makes all fields nullable in keeping with [GraphQL
*best practices](https://graphql.org/learn/best-practices/#nullability). This
*behavior can be changed by setting the config option `nullableByDefault` to
`false`.

With `nullableByDefault` _enabled_, you may declare an individual field as
nonnullable adding the docblock tag `@killsParentOnException`.  This will cause
the field to be typed as non-nullable, but _it comes at a price_.  Should the
resolver throw, the error will bubble up to the first nullable parent. If
`@killsParentOnException` is used too liberally, small errors can take down huge
portions of your query.

Dissabling `nullableByDefault` is equivilent to marking all nonnullable fields
with `@killsParentOnException`.

```ts
/**
 * @gqlField 
 * @killsParentOnException
 */
myField(): string {
  return this.someOtherMethod();
}
```

#### Field arguments

If you wish to define arguments for a field, define your argument types inline:

```ts
/** @gqlField */
myField(args: { greeting: string }): string {
  return `${args.greeting} World`;
}
```

Default values for arguments can be defined by using the `=` operator with destructuring:

```ts
/** @gqlField */
myField({ greeting = "Hello" }: { greeting: string }): string {
  return `${greeting} World`;
}
```

```ts
/** @gqlField */
myField({ greeting = { salutation: "Sup" } }: { greeting: GreetingConfig }): string {
  return `${greeting.salutation} World`;
}
```

#### Field descriptions

Arguments can be given descriptions by using the `/**` syntax:

```ts
/** @gqlField */
myField(args: { 
  /** A description of the greeting argument */
  greeting: string
}): string {
  return `${args.greeting} World`;
}
```

#### Deprecated fields

To mark a field as deprecated, use the `@deprecated` JSDoc tag:

```ts
/** 
 * @gqlField
 * @deprecated Please use myNewField instead.
 */
myOldField(): string {
  return "Hello World";
}
```

#### Functional style fields

Sometimes you want to add a computed field to a non-class type, or extend base
types like `Query` or `Mutation` from another file. Both of these usecases are
enabled by placing a `@gqlField` before an exported function declaration.

In this case, the function should expect an instance of the base type as the
first argument, and an object representing the GraphQL field arguments as the
second argument. The function should return the value of the field.

Extending Query:

```ts
/** @gqlField */
export function userById(_: Query, args: {id: string}): User {
  return DB.getUserById(args.id);
}
```

Extending Mutation:

```ts
/** @gqlField */
export function deleteUser(_: Mutation, args: {id: string}): boolean {
  return DB.deleteUser(args.id);
}
```

Note that Grats will use the type of the first argument to determine which type
is being extended. So, as seen in the previous examples, even if you don't need
access to the instance you should still define a typed first argument.

### @gqlUnion

GraphQL unions can be defined by placing a `@gqlUnion` docblock directly before a:

* Type alias of a union of object types

```ts
/** 
 * A description of my union.
 * @gqlUnion <optional name of the union, if different from type name>
 */
type MyUnion = User | Post;
```

### @gqlScalar

GraphQL custom sclars can be defined by placing a `@gqlScalar` docblock directly before a:

* Type alias declaration

```ts
/** 
 * A description of my custom scalar.
 * @gqlScalar <optional name of the scalar, if different from type name>
 */
type MyCustomString = string;
```

Note: For the built-in GraphQL scalars that don't have a corresponding TypeScript type, Grats ships with type aliases you can import. You may be promted to use one of these by Grat if you try to use `number` in a positon from which Grat needs to infer a GraphQL type.

```ts
import { Float, Int, ID } from "grats";

/** @gqlType */
class Math {
  id: ID;
  /** @gqlField */
  round(args: {float: Float}): Int {
    return Math.round(args.float);
  }
}
```

### @gqlEnum

GraphQL enums can be defined by placing a `@gqlEnum` docblock directly before a:

* TypeScript enum declaration
* Type alias of a union of string literals

```ts
/** 
 * A description of my enum.
 * @gqlEnum <optional name of the enum, if different from type name>
 */
enum MyEnum {
  /** A description of my variant */
  OK = "OK",
  /** A description of my other variant */
  ERROR = "ERROR"
}
```

Note that the values of the enum are used as the GraphQL enum values, and must
be string literals.

To mark a variants as deprecated, use the `@deprecated` JSDoc tag directly before it:

```ts
/** @gqlEnum */
enum MyEnum {
  OK = "OK"
  /** @deprecated Please use OK instead. */
  OKAY = "OKAY"
  ERROR = "ERROR"
}
```

We also support defining enums using a union of string literals, however there
are some limitations to this approach:

* You cannot add descriptions to enum values
* You cannot mark enum values as deprecated

This is due to the fact that TypeScript does not see JSDoc comments as
"attaching" to string literal types.

```ts
/** @gqlEnum */
type MyEnum = "OK" | "ERROR";
```

### @gqlInput

GraphQL input types can be defined by placing a `@gqlInput` docblock directly before a:

* Type alias declaration

```ts
/** 
 * Description of my input type
 * @gqlInput <optional name of the input, if different from type name>
 */
type MyInput = {
  name: string;
  age: number;
};
```

## Example

See `examples/express-graphql/` in the repo root for a working example. Here we
run the static analysis at startup time. Nice for development, but not ideal for
production where you would want to cache the schema and write it to disk for
other tools to see.

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

* [@mofeiZ](https://github.com/mofeiZ) and [@alunyov](https://github/alunyov) for their Relay hack-week project exploring a similar idea.
* [@josephsavona](https://github.com/josephsavona) for input on the design of [Relay Resolvers](https://relay.dev/docs/guides/relay-resolvers/) which inspired this project.
* [@bradzacher](https://github.com/bradzacher) for tips on how to handle TypeScript ASTs.
* Everyone who worked on Meta's Hack GraphQL server, the developer experince of which inspired this project.
* A number of other projects which seem to have explored similar ideas in the past:
  * [ts2gql](https://github.com/convoyinc/ts2gql)
  * [ts2graphql](https://github.com/cevek/ts2graphql)
  * [typegraphql-reflection-poc](https://github.com/MichalLytek/typegraphql-reflection-poc)
