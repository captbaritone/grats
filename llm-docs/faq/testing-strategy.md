# Testing Strategy

_This doc describes how Grats' own codebase is tested. It does not describe testing code written using Grats._

* * *

One of the joys of working on compilers or compiler-like tools is that, complex as they may be, they can be thought of as "just" a pure function. This means if you have a large enough collection of test cases which assert "for this input, I expect this output", you can make ambitious changes to the tool and be confident that the observable behavior hasn't changed.

Grats leans heavily into this approach but then takes it even further by using a similar testing approach to validate runtime behavior, the correctness of example snippets in our docs and even our example apps.

## Unit Tests

Grats attempts to cover every feature, capability, edge case, regression, and error message with a unit test. Our unit tests take the form of fixture files. Each fixture is a single `.ts` file consisting of the minimal code needed to exercise exactly one permutation of one feature. While grouping many examples of a feature into a single file might be more convenient, we try to avoid it, since it makes it harder to understand what is being tested and what is expected. Instead, the fixtures directory is organized into subdirectories which group related fixtures together.

The test suite is written in Rust and runs with `cargo test`. During testing Grats is run on each fixture file to produce a sibling `.expected.md` file. This Markdown file includes the fixture's input followed by either the expected error message for that input or the expected compiler output. In the error case a full pretty-printed error is included so that the error message as well as the source locations being referenced are clearly visible. If any of the errors have automatic fixes, the file also shows each fix and the fixed code. In the success case, the output file contains both the generated `.graphql` schema as well as the generated `.ts` module which builds the `GraphQLSchema`. Fixtures which are expected to report errors include `.invalid` in their file name, and the test fails if a fixture's result doesn't match its name.

Fixture files also support a special syntax where the file can start with a comment containing JSON, which allows the test to specify certain Grats config options. This allows fixture files to be just a single `.ts` file but still be able to test different configurations of Grats.

If the output of running Grats on the `.ts` file does not match the `.expected.md` file, the test fails and shows a diff. Running the tests with `--write` regenerates the `.expected.md` files. This is how we ensure that Grats is behaving as expected while also allowing for evolution in the case that a change intentionally changes the output.

_At the time of writing, Grats has 515 unit test fixtures._

## Integration Tests

Grats' second tier of tests are integration tests which validate the runtime behavior of the TypeScript code that Grats generates. Similar to our unit tests these are fixture tests, each consisting of a directory containing a single `index.ts` file. However, here each file is expected to produce a valid schema and also export a property `query`, which is a GraphQL query string which will be executed.

The Rust test suite generates the schema for each fixture, and the generated `schema.ts` and `schema.graphql` files are checked in alongside it. Then a JavaScript test runner executes the query against the generated schema using `graphql-js`. The sibling `index.ts.expected.md` file contains the result of executing that query.

_At the time of writing, Grats has 29 integration test fixtures._

## Docs Examples

One perennial challenge with software libraries is ensuring the example code in the library's docs is both well formed _and_ stays in sync with the library's behavior/API as it evolves.

Additionally, for a tool like Grats, it can be helpful to let users see the output produced for each example, or even to let them try editing the example themselves to see how it changes the output.

Grats attempts to solve all of these problems by running Grats on each example snippet as part of our test suite (which runs in our CI) and then checking in the resulting artifacts. This means:

-   Changes which cause any example in the docs to fail to compile, or produce different output, will be noticed before the change is merged and can be addressed.
-   Newly added docs are automatically validated that they produce the expected output.
-   Readers of the docs can toggle between the example code and the output to see how the example code is transformed into a GraphQL schema.
-   Each example snippet includes a link to load the example in our in-browser .

One key piece of this strategy is support for comments `// trim-start` and `// trim-end` which allows the examples to include additional content needed for the example to compile but which we can omit from the snippet displayed in the docs.

**For example:**

```tsx
const DB: any = {};

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlQueryField */
export function userById(id: string): User {
  return DB.getUserById(id);
}
```

_Generated GraphQL schema:_

```graphql
type Query {
  userById(id: String!): User
}

type User {
  name: String
}
```

_At the time of writing Grats has 75 example snippets in the docs._

## Example Apps

A key part of Grats' documentation is its collection of [example apps](../examples.md). These are minimal end to end implementations of GraphQL servers implemented using Grats. Each example app is a standalone TypeScript project whose `tsconfig.json` configures Grats to generate the schema for the app. We expect users to be able to reference these apps by either cloning or copy/pasting bits of the apps to get started with their own projects.

There are few things more frustrating than copying some code from an example, having it not work and then realizing it had a bug or was out of date. Additionally, example projects are generally not under any kind of production use so it can be easy to miss things that end up breaking the example projects.

To address this, each example app implements a simple interface:

1.  It has a `package.json` file with a `start` script which starts the server.
2.  It either implements a common schema subset or has a `testConfig.json` file which specifies test queries to run against the server.

Grats' CI runs a script which builds each example app, starts the server and then runs a series of queries against the server. If the server does not respond as expected, the test fails.

This not only ensures that all example apps are generally always working as expected, but also allows each example app to act as an additional integration test, ensuring Grats' compatibility with that app's specific configuration.

_At the time of writing Grats has 7 example apps._

## All Together

Taken together these four types of tests allow us to quickly and confidently evolve and improve Grats using a test-driven approach while also ensuring that the documentation and examples are always up to date and working as expected.
