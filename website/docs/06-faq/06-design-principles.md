# Design Principles

This document describes the design principles of Grats. These are not hard and fast rules, but rather a set of principals I'm trying to consider when making design decisions and tradeoffs. For a concrete description of how Grats _actually_ works, see [How Grats Works](./03-how-grats-works.md).

## Integrate into the user's existing code

TypeScript aims to be a type system that can model existing JavaScript idioms, rather than expecting users to adapt their code style to fit the type system. Grats, should operate in the same way. Where possible, Grats should enable users to build a GraphQL schema by adding docblock tags to their existing code, rather than asking users to adapt their code style to fit an opinionated Grats' style.

## Progressive disclosure

Grats should have a small user-facing API that is intuitive to use. Users should feel empowered to apply docblock tags to their code confident that Grats will either do the obvious right thing, or fail with a clear error message informing the user of both _why_ what they tried cannot or does not work, and what they should do instead. This should allow us to keep documentation brief and focused on the happy path, while providing guidance about complex cases only as the user encounters them. In other words, we should consider our error messages to be a part of our documentation that is disclosed to users at exactly the moment they need it.

## Internal complexity is okay

Grats should be willing to take on additional internal complexity if it means being able to do the obviously right thing in more cases. Alternatively, features that add external complexity or API surface area should be avoided where possible.

That said, internal complexity should taken on with caution. Grats should be willing to wait to add add features/improvements which require internal complexity until we see an architectural design that will make the complexity maintainable.

## Incremental improvements

There are a potentially large number of types of syntax that Grats could learn to parse. It is not feasible to support all of them at once. Instead, Grats should grow more capable over time, guided by concrete examples of real apps that would benefit from the additional capabilities. Grats should try to avoid adding features that are not immediately useful to real apps.

## No new concepts

Grats should try to avoid introducing new concepts to the GraphQL ecosystem. Docblocks tags should represent constructs that are well defined in the GraphQL spec, and should feel familiar to those who have used GraphQL in other contexts/languages. Ideally each docblock tag should correspond directly to the GraphQL schema construct it creates.

## A few dependencies well leveraged

Grats should have a small number of dependencies, and should leverage those dependencies to their fullest extent. For example, Grats uses [`graphql-js`](https://graphql.org/graphql-js/) for constructing, serializing, and validating GraphQL schemas, rather than implementing its own schema construction and validation logic. Similarly, Grats uses TypeScript's own AST parsing, type inference logic, and code serialization rather than implementing its own.

In it's public APIs, Grats should expose the same types and concepts that are used by the underlying dependencies, rather than introducing new concepts that are redundant or confusing.

Where other utility tools are needed, Grats should consider maintaining/forking/vendoring its own implementation of exactly the functionality it needs, rather than taking on a dependency on a larger library that provides more functionality than is needed.

## Test-validated behavior

All externally visible behavior of Grats should be captured by our fixture tests, including errors. Every added feature or capability, as well as every bug fix, should be accompanied by a new fixture test that demonstrates the changed behavior.

Fixture tests should be narrow in focus, that consist of the minimal amount of code necessary to demonstrate the behavior being tested. It's perfectly fine to have many many fixture tests. For more on Grats' testing strategy, see [Testing Strategy](./07-testing-strategy.mdx).
