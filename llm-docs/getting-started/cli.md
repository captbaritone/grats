# CLI

Grats' interface is a command-line utility for extracting your project's GraphQL schema. It aims to be user friendly and helpful! You should expect the Grats CLI to give helpful error messages which guide you to a solution.

Grats gets its [configuration options](./configuration.md) from your project's `tsconfig.json` file. By default Grats uses the first `tsconfig.json` it finds in the current working directory or one of its parent directories. However, if you wish to use a different `tsconfig.json` file, you can specify it with the `--tsconfig` option.

> **TIP:**
> For guidance on how to make Grats easy to run in your project see [Workflows](../guides/workflows.md).

## Build (default command)

Grats' default command (build) creates a TypeScript module containing an executable GraphQL schema _and_ a `.graphql` file containing the schema text. By default it places these files adjacent to your `tsconfig.json` file. If you wish to place them elsewhere, you can [configure](./configuration.md) this in your `tsconfig.json` file.

```bash
npx grats
```

Or, if you want to leave Grats running while you work, you can use the `--watch` option.

```bash
npx grats --watch
```

### Automatic Fixes

Grats can automatically fix certain issues it detects in your code. Use the `--fix` flag to enable automatic fixing:

```bash
npx grats --fix
```

This will automatically apply fixes for issues like:

-   Incorrect casing in docblock tags (e.g., `@gqltype` → `@gqlType`)
-   Deprecated docblock tags that have replacements

The `--fix` flag can also be combined with `--watch` mode:

```bash
npx grats --watch --fix
```

### Validating generated files

If you check your generated files into version control, you can use the `--validate` flag to check that they are up to date without writing anything to disk:

```bash
npx grats --validate
```

Grats exits with a non-zero code if any generated file is missing or needs to be updated. This is useful in CI, to ensure the checked-in schema always matches the implementation. See [Workflows](../guides/workflows.md) for a recommended CI setup.

### Options

```text
Extract GraphQL schema from your TypeScript project

Usage: grats [OPTIONS] [COMMAND]

Commands:
  locate  Print the location of a GraphQL entity
  help    Print this message or the help of the given subcommand(s)

Options:
      --tsconfig <TSCONFIG>  Path to tsconfig.json. Defaults to auto-detecting based on the current working directory
      --watch                Watch for changes and rebuild schema files as needed
      --validate             Check that the generated files are up to date, without writing anything to disk. Exits with a non-zero code if any file needs to be updated
      --fix                  Automatically fix fixable diagnostics
  -h, --help                 Print help
  -V, --version              Print version
```

## Locate

The `locate` command reports the location (file, line, column) at which a given type or field is defined in your code. `grats locate` is also meant to be invoked by other tools: a GraphQL client, a code generator or an editor extension can use it to map a schema member back to the code which defines it, without knowing anything about how Grats works.

Grats itself does not ship an editor integration.

```bash
# Locate a field
npx grats locate User.name

# Locate a named type
npx grats locate User
```

### Options

```text
Print the location of a GraphQL entity

Usage: grats locate [OPTIONS] <ENTITY>

Arguments:
  <ENTITY>  GraphQL entity to locate. E.g. `User` or `User.id`

Options:
      --tsconfig <TSCONFIG>  Path to tsconfig.json. Defaults to auto-detecting based on the current working directory
  -h, --help                 Print help
```
