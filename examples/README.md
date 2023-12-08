# Grats Example Projects

This directory contains example projects that use Grats. You can read more about them in the [Grats documentation](https://grats.capt.dev/docs/examples/).

## As tests

These examples also operate as integration tests for Grats. You can run them with:

```bash
pnpm run integration-tests
```

Each project is expected to implement a common schema subset and the integration tests will take the following steps:

0. (Assume the project is already built)
1. Run `pnpm run start` in the project directory
2. Wait for exactly one line of output from the project to signal it's ready
3. Send a series of queries to the project's GraphQL endpoint (default `/graphql` on port 4000)
4. Assert that the responses match the expected output

## `testConfig.json`

Not all servers are identical. To account for this projects can specify how they should be run via a couple methods.

Projects may define a `testConfig.json` file in their root directory. This file should be a JSON object with the following optional properties:

- `port`: The port the project should be run on. Defaults to `4000`.
- `route`: The endpoint the project should be run on. Defaults to `/graphql`.
- `nodeVersion`: The version of Node the project should be run on. Tests will be skipped when run on other versions of Node, for example in CI where we run multiple versions of node.

I could imagine us expanding this to include other configuration options and even additional query/response pairs to test, but for now this is all we need.
