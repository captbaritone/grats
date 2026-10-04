# Deno

Using Grats in a [Deno](https://deno.com/) project, serving the generated schema with `Deno.serve`.

Grats is a native binary, so it doesn't need Node to run: `deno run -A npm:grats` is enough.

Deno projects do need two settings which other projects don't, because Grats resolves imports through `node_modules` and reads its configuration from `tsconfig.json`:

-   **A `node_modules` directory**, so Grats can resolve the `grats` package and read the docblocks which define `Int`, `Float` and `ID`. Projects with a `package.json` get one automatically; projects with only a `deno.json` need `"nodeModulesDir": "auto"`.
-   **[`importModuleSpecifierEnding`](../getting-started/configuration.md#importModuleSpecifierEnding) set to `.ts`**, since Deno requires an extension on relative imports and Grats omits it by default.

The example's README explains both, including the errors you get without them.

**[https://github.com/captbaritone/grats/tree/main/examples/deno](https://github.com/captbaritone/grats/tree/main/examples/deno)**

## Libraries used

-   `graphql-http`
-   `graphql-js`
