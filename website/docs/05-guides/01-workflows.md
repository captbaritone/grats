# Workflows

This document includes some advice on how to set up your project and processes to
make the most of Grats.

## Make it easy to run Grats

We recommend that you add a `grats` script to your project's `package.json`.

```json
{
  "scripts": {
    "grats": "grats"
  }
}
```

This way any contributor can regenerate the schema by running `npm run grats`.

:::info
You can pass additional arguments to Grats by adding them after `--`. For example:

```bash
npm run grats -- --watch
```

:::

## Check in your schema

We recommend that you include Grats' generated GraphQL and TypeScript schemas in
your repository. This approach has several advantages:

1. You can easily see the changes to your schema during code reviews.
2. Manually inspecting the schema is as simple as opening a file.
3. Other tools, such as GraphiQL, client codegen, and editor integrations can easily access the schema.
4. Allows other code tools to see that your GraphQL code is used (not "dead code").

## Managing autoformatting and generated files

We recommend that you disable autoformatting for the generated files, for example by adding the generated file paths to your `.prettierignore` file. Note that these paths will be different if you've changed their location in your [Grats configuration](../01-getting-started/03-configuration.mdx).

```txt title="/.prettierignore"
/schema.graphql
/schema.ts
```

If you do wish to keep them formatted, we recommend that you apply that formatting as part of your `grats` npm script command:

```json title="/package.json"
{
  "scripts": {
    "grats": "grats && prettier --write schema.graphql schema.ts"
  }
}
```

## Continuous integration

To ensure that your code base does not get into a state where Grats cannot
extract types due to errors, and that your schema file always matches your
implementation, we recommend that you add a CI step that runs Grats with the
`--validate` flag:

```bash
npx grats --validate
```

This checks that the generated files are up to date without writing anything
to disk, and exits with a non-zero code if any file needs to be updated — so
the step fails when the checked-in schema doesn't match the implementation.

Grats does not type check your code, so your CI should also run `tsc` to catch type errors.
