# Contributing

Below is some guidance on how to work on this project. If you have any questions, please feel free to open an issue.

## Building

Parts of Grats are implemented in Rust (see `grats-rs/`) and compiled to
WebAssembly. To build, you need [rustup](https://rustup.rs), which installs the
toolchain pinned in `grats-rs/rust-toolchain.toml`.

`pnpm build` compiles the Rust code and embeds it in
`src/rs/wasm.generated.ts`. Run `pnpm build:wasm` to rebuild just that file,
which the tests need, after changing Rust code.

The Rust code has its own tests:

```
cd grats-rs
cargo test
```

## Automated Tests

Our tests are written as a collection of fixture files located in
`src/tests/fixtures`, `src/tests/configParserFixtures` and
`src/tests/integrationFixtures`. Each test case's output is compared to its
corresponding `.expected.md` file. If the output does not match the expected
output, the test runner will fail.

The tests in `src/tests/fixtures` are unit tests that test the behavior of the
extraction and code generation. They extract GraphQL SDL, generated `schema.ts` or any associated errors and code actions from the file and write that as output.

If the test includes a line like `// Locate: User.name` of `// Locate: SomeType`
then the test runner will instead locate the given entity and write the location
as output.

The tests in `src/tests/configParserFixtures` test the parsing of the Grats
config in each `.json` file.

These two directories are tested by Rust, which also generates the
`schema.ts` and `schema.graphql` files for `src/tests/integrationFixtures`
(see below), and the `.out` file shown with each `.grats.ts` snippet in the
website, so changes to the docs' output show up as fixture changes:

```
cd grats-rs
cargo test --test fixtures
```

To run specific test cases, provide a substring match for the test fixtures'
paths, and to update fixture files, use the `--write` flag:

```
cargo test --test fixtures -- import
cargo test --test fixtures -- --write
```

The tests in `src/tests/integrationFixtures` are integration tests that test the _runtime_ behavior of the generated code. Each directory contains an `index.ts` file with `@gql` docblock tags which exports a root query class as the named export `Query` and a GraphQL query text under the named export `query`. Its schema is generated next to it by `cargo test --test fixtures`, and then

```
pnpm run test
```

checks that the generated `schema.ts` matches the generated `schema.graphql`,
executes the query against it and emits the returned response JSON as the test
output.

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

## `llm-docs/` Directory

The `llm-docs/` directory contains auto-generated Markdown files exported from the Docusaurus website build. These files are included in the npm package so that AI coding agents can access the documentation.

**Do not edit these files directly.** They are regenerated by the `docs-export` Docusaurus plugin each time the website is built. To update them:

1. Edit the source docs in `website/docs/`
2. Run `cd website && pnpm run build`
3. Commit the updated `llm-docs/` files

CI will fail if the committed `llm-docs/` files are out of date.
