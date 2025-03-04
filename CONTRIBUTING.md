# Contributing

Below is some guidance on how to work on this project. If you have any questions, please feel free to open an issue.

## Automated Tests

Our tests are written as a collection of fixture files located in
`src/tests/fixtures` and `src/tests/integrationFixtures`. Each `.ts` file nested
within this directory is a test case. The test runner will execute each test
case and compare the output to corresponding `.expected.ts` file. If the
output does not match the expected output, the test runner will fail.

The tests in `src/tests/fixtures` are unit tests that test the behavior of the
extraction and code generation. They extract GraphQL SDL, generated `schema.ts` or any associated errors and code actions from the file and write that as output.

If the test includes a line like `// Locate: User.name` of `// Locate: SomeType`
then the test runner will instead locate the given entity and write the location
as output.

The tests in `src/tests/integrationFixtures` are integration tests that test the _runtime_ behavior of the generated code. Each directory contains an `index.ts` file with `@gql` docblock tags which exports a root query class as the named export `Query` and a GraphQL query text under the named export `query`. The test runner will execute the query against the root query class and emit the returned response JSON as the test output.

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

Interactive mode will prompt you to update the fixture files one by one for each failing fixture test.

```
pnpm run test --interactive
```

You an also get help with the CLI flags:

```
pnpm run test --help
```

All changes that affect the behavior of the tool, either new features of bug
fixes, should include at least one new or changed fixture file.

## Manual Tests

The code base includes a number of example servers that can be used to manually test
features of the tool. To start the server, run the following command:

```bash
# Ensure you build grats first!

pnpm build
cd examples/yoga
pnpm install
pnpm run start
```

This will start a web server running GraphiQL which you can use to try out the server.

## NPM Releases

GitHub CI publishes a release to npm for each commit. They use the version number convention `0.0.0-main-<git hash prefix>`.

To publish a new numbered release:

Update [the changelog](./website/docs/07-changelog/index.md) with the new version number and a summary of the changes.

```bash
./scripts/release.sh
```

You probably want to upgrade Grats in the Code Sandbox example:

https://capt.dev/grats-sandbox

## NPM Auth Token

GitHub needs a special NPM token to be able to publish each commit's release. These expire regularly, so here's the steps to recreate them:

1. Navigate to `https://www.npmjs.com/settings/captbaritone/tokens` and login
2. Select the "Generate New Token" green button in the top left to spawn a dropdown
3. Select "Granular Access Token"
4. Fill in details
   - _Package Scope_: Read and Write, only select packages: Grats
   - _Organizations_: No access
5. Select "Generate Token"
6. Copy the token
7. Navigate to `https://github.com/captbaritone/grats/settings/environments/951200327/edit`
8. Scroll down to "Environment Secrets"
9. Find the secret named `NPM_TOKEN` and click the "edit" icon
10. Auth with security device as needed
11. PAste in the token you copied in step 6

## Documentation Releases

Documentation updates are automatically picked up by Netlify and published.
