# CLI

Grats includes a command-line utility for extracting your project's GraphQL schema.

```bash
npx grats --output=./schema.gql
```

Grats gets both it's [configuration options](02-configuration.md) and the set of TypeScript files to scan from your project's `tsconfig.json` file. By default Grats uses the TypeScript's own algorithm for locating your project's `tsconfig.json`. However, if you wish to use a different `tsconfig.json` file, you can specify it with the `--tsconfig` option.

:::tip
For guidance on how to make Grats easy run in your project see [Workflows](../05-guides/01-workflows.md).
:::

## Options

```
Usage: grats [options]

Extract GraphQL schema from your TypeScript project

Options:
  -V, --version               output the version number
  -o, --output <SCHEMA_FILE>  Where to write the schema file. Defaults to stdout
  --tsconfig <TSCONFIG>       Path to tsconfig.json. Defaults to auto-detecting based on the current working directory
  -h, --help                  display help for command
```