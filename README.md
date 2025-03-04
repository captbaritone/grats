# Grats: Implementation-First GraphQL for TypeScript

**The simplest way to build a GraphQL server in TypeScript**

When you write your GraphQL server in TypeScript, your fields and resolvers
are _already_ annotated with type information. _Grats leverages your existing
type annotations to automatically extract an executable GraphQL schema from your
generic TypeScript resolver code._

By making your TypeScript implementation the source of truth, you never have to
worry about validating that your implementation matches your schema. Your
implementation _is_ your schema!

Read the [blog post](https://jordaneldredge.com/blog/grats).

## Example

Here's what it looks like to define a User type with a greeting field using Grats:

```ts
/** @gqlType */
class User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  greet(args: { greeting: string }): string {
    return `${args.greeting}, ${this.name}`;
  }
}
```

After running `npx grats`, you'll find a `schema.ts` module that exports an executable schema, and a `schema.graphql` file contains your GraphQL schema definition:

```graphql
type User {
  name: String
  greet(greeting: String!): String
}
```

That's just the beginning! To learn more, **Read the docs: https://grats.capt.dev/**

[![Join our Discord!](https://img.shields.io/discord/1089650710796320868?logo=discord)](https://capt.dev/grats-chat)

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) in the repo root for details on how to make changes to this project.

# Acknowledgements

- [@mofeiZ](https://github.com/mofeiZ) and [@alunyov](https://github/alunyov) for their Relay hack-week project exploring a similar idea.
- [@josephsavona](https://github.com/josephsavona) for input on the design of [Relay Resolvers](https://relay.dev/docs/guides/relay-resolvers/) which inspired this project.
- [@bradzacher](https://github.com/bradzacher) for tips on how to handle TypeScript ASTs.
- Everyone who worked on Meta's Hack GraphQL server, the developer experience of which inspired this project.
- A number of other projects which seem to have explored similar ideas in the past:
  - [ts2gql](https://github.com/convoyinc/ts2gql)
  - [ts2graphql](https://github.com/cevek/ts2graphql)
  - [typegraphql-reflection-poc](https://github.com/MichalLytek/typegraphql-reflection-poc)

## License

Grats is [MIT licensed](./LICENSE).
