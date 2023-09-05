# Contributing

Below is some guidance on how to work on this project. If you have any questions, please feel free to open an issue.

## Automated Tests

Our tests are written as a collection of fixture files located in
`src/tests/fixtures` and `src/tests/integrationFixtures`. Each `.ts` file nested
within this directory is a test case. The test runner will execute each test
case and compare the output to corresponding `.expected.ts` file. If the
output does not match the expected output, the test runner will fail.

The tests in `src/tests/fixtures` are unit tests that test the behavior of the
extraction. They extract GraphQL SDL from the file and write that as output.

If the test includes a line like `// Locate: User.name` of `// Locate: SomeType`
then the test runner will instead locate the given entity and write the location
as output.

The tests in `src/tests/integrationFixtures` are integration tests that test the _runtime_ behavior of the tool. They expect each file to be a `.ts` file with `@gql` docblock tags which exports a root query class as the named export `Query` and a GraphQL query text under the named export `query`. The test runner will execute the query against the root query class and emit the returned response JSON as the test output.

```

pnpm run test

```

To run a specific test case, you can use the `--filter` flag and provide a
substring match for the test fixture's path.

```

pnpm run test --filter=import

```

To update fixture files, you can use the `--write` flag.

```

pnpm run test --write

```

You an also get help with the CLI flags:

```

pnpm run test --help

```

All changes that affect the behavior of the tool, either new features of bug
fixes, should include at least one new or changed fixture file.

## Manual Tests

The code base includes an example server that can be used to manually test
features of the tool. To start the server, run the following command:

```

# Ensure you build grats first!

pnpm build
cd examples/express-graphql
pnpm install
pnpm run start

```

This will start a web server running GraphiQL which you can use to try out the server.

```

```
