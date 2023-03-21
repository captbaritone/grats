# Design Principles

This document describes the design principles of {LIBRARY_NAME}. These are not hard and fast rules, but rather a set of principals to consdier when making design decisions tradeoffs.

## Progressive disclosure

{LIBRARY_NAME} should have a small user-facing API that is intuitive to use. Users should feel empowered to apply docblock tags to their code confident that the library will either do the obvious right thing, or fail at build time with a clear error message informing the user of both _why_ what they tried cannot or does not work, and what they should do instead. This should allow us to keep documentation breif and focused on the happy path, while providing guidance about complex cases only as the user encounters them. In other words, we should consider our error messages to be a part of our documentation that is disclosed to users at exactly the moment they need it.

## Internal complexity is okay

{LIBRARY_NAME} should be willing to take on additional internal complexity if it means being able to do the obviously right thing in more cases. Alternatively, features add external complexity or API surface area should be avoided where possible.

## Incremental improvements

There are a potentially large number of types of syntax that {LIBRARY_NAME} could learn to parse. It is not feasible to support all of them at once. Instead, {LIBRARY_NAME} should grow more capable over time, guided by concrete examples of real apps that would benefit from the additional capabilities. {LIBRARY_NAME} should try to avoid adding features that are not immediately useful to real apps.

## No new concepts

Aside from the `@GQL` docblock tag, {LIBRARY_NAME} should not introduce any new concepts to the GraphQL ecosystem. Docblocks should represent constructs that are well defined in the GraphQL spec, and should feel familiar to those who have used GraphQL in other contexts/languages.

## A few dependencies well leveraged

{LIBRARY_NAME} should have a small number of dependencies, and should leverage those dependencies to their fullest extent. For example, {LIBRARY_NAME} should use the `graphql-js` for constructing, serializing, and validating GraphQL schemas, rather than implementing its own schema construction and validation logic. Similarly, {LIBRARY_NAME} should use TypeScript's own AST parsing and type inference logic, rather than implementing its own.

In it's public APIs, {LIBRARY_NAME} should expose the same types and concepts that are used by the underlying dependencies, rather than introducing new concepts that are redundant or confusing.

Where other utility tools are needed, {LIBRARY_NAME} should consider mainting/forking/vendoring its own implememtatation of exactly the functionality it needs, rather than taking on a dependency on a larger library that provides more functionality than is needed.

## Test validated behavior

All externally visible behavior of {LIBRARY_NAME} should be captured by our fixture tests, including errors. Every added feature or capability, as well as every bug fix, should be accompanied by a new fixture test that demonstrates the changed behavior.

Fixture tests should be narrow in focus, that containst the minimal amount of code necessary to demonstrate the behavior being tested. It's perfectly fine to have many many fixture tests.