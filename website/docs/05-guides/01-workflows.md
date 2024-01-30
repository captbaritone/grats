# Workflows

This document includes some advice on how to setup your project and processes to
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

We recommend that you disable autoformatting for the generated files. For example by adding the generated file paths to your `.prettierignore` file. Note that these paths will be different if you've changed their location in your [Grats configuration](../01-getting-started/03-configuration.md).

```txt title="/.prettierignore"
./schema.graphql
./schema.ts
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
implementation, we recommend that you add a CI step that runs Grats and ensures
that the schema matches the checked-in version.

Here's what an example script might look like:

```bash
#!/bin/bash

# Exit if any command fails
set -e

# Run Grats
npm run grats

# Check that it didn't change anything
if [ -n "$(git status --porcelain)" ]; then
    echo "Schema file is out of date. Please run 'npm run grats' and commit the changes."
    git diff
    exit 1
fi
```
