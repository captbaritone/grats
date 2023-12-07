# CLI

Grats's interface is a command-line utility for extracting your project's GraphQL schema. It aims to be user friendly and helpful! You should expect the Grats CLI to give helpful error messages which guide you to a solution

Grats gets it's [configuration options](./03-configuration.md) from your project's `tsconfig.json` file. By default Grats uses the TypeScript's own algorithm for locating your project's `tsconfig.json`. However, if you wish to use a different `tsconfig.json` file, you can specify it with the `--tsconfig` option.

:::tip
For guidance on how to make Grats easy run in your project see [Workflows](../05-guides/01-workflows.md).
:::

# Build (default command)

Grats' default command (build) creates a TypeScript module containing an executable GraphQL schema _and_ a `.graphql` file containing the schema text. By default it places these files adjacent to your `tsconfig.json` file. If you wish to place them elsewhere, you can [configure](./03-configuration.md) this in your `tsconfig.json` file.

```bash
npx grats
```

### Options

```
Usage: grats [options] [command]

Extract GraphQL schema from your TypeScript project

Options:
  -V, --version               output the version number
  --tsconfig <TSCONFIG>       Path to tsconfig.json. Defaults to auto-detecting based on the current working directory
  -h, --help                  display help for command

Commands:
  locate [options] <ENTITY>
```

# Locate

The `locate` command reports the location (file, line, column) at which a given type or field is defined in your code. `grats locate` can also be invoked by other tools. For example the click-to-definition feature of an GraphQL editor integration could use invoke this command to find the location of a type or field.

For example, Relay's VSCode Extension is [exploring](https://github.com/facebook/relay/pull/4434) adding the ability to leverage such a tool.

```bash
# Locate a field
npx grats locate User.name

# Locate a named type
npx grats locate User
```

### Options

```
Usage: grats locate [options] <ENTITY>

Arguments:
ENTITY                 GraphQL entity to locate. E.g. `User` or `User.id`

Options:
  --tsconfig <TSCONFIG>  Path to tsconfig.json. Defaults to auto-detecting based on the current working directory
  -h, --help             display help for command
```
