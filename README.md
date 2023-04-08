# -=[ ALPHA SOFTWARE ]=-

**Grats is still experimental. Feel free to try it out and give feedback, but they api is still in flux**

# Grats: Implementation-First GraphQL for TypeScript

[![Join our Discord!](https://img.shields.io/discord/1089650710796320868?logo=discord)](https://capt.dev/grats-chat)

**What if building a GraphQL server were as easy as writing the resolvers?**

When you write your GraphQL server in TypeScript, your fields and resovlers
are _already_ annotated with type information. _Grats leverages your existing
type annotations to automatically extract an executable GraphQL schema from your
generic TypeScript resolver code._

By making your TypeScript implementation the source of truth, you never have to
worry about valiating that your implementiaton matches your schema. Your
implementation _is_ your schema!

## Read the docs: https://capt.dev/grats

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) in the repo root for details on how to make changes to this project.

# Acknowledgements

* [@mofeiZ](https://github.com/mofeiZ) and [@alunyov](https://github/alunyov) for their Relay hack-week project exploring a similar idea.
* [@josephsavona](https://github.com/josephsavona) for input on the design of [Relay Resolvers](https://relay.dev/docs/guides/relay-resolvers/) which inspired this project.
* [@bradzacher](https://github.com/bradzacher) for tips on how to handle TypeScript ASTs.
* Everyone who worked on Meta's Hack GraphQL server, the developer experince of which inspired this project.
* A number of other projects which seem to have explored similar ideas in the past:
  * [ts2gql](https://github.com/convoyinc/ts2gql)
  * [ts2graphql](https://github.com/cevek/ts2graphql)
  * [typegraphql-reflection-poc](https://github.com/MichalLytek/typegraphql-reflection-poc)
