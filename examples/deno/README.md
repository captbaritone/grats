# Grats + Deno

An example of using Grats in a [Deno](https://deno.com/) project, serving the
generated schema with `Deno.serve`.

Grats itself is a native binary, so it does not need Node to run. You can
invoke it straight from Deno:

```bash
deno run -A npm:grats
deno run -A server.ts
```

## Two settings Deno projects need

Grats reads your project the way a bundler does: it resolves imports through
`node_modules`, and it reads its configuration from `tsconfig.json`. Deno does
neither by default, so a Deno project needs two settings which other projects
don't.

### 1. Give Deno a `node_modules` directory

Grats resolves `import { Int } from "grats"` to the `grats` package on disk, so
that it can read the docblocks which define `Int`, `Float` and `ID`. By default
Deno keeps npm packages in its own cache (`~/.cache/deno`) rather than in
`node_modules`, where Grats cannot find them. Without this you will get:

```
error: Unable to resolve type reference.
```

If your project has a `package.json`, as this example does, Deno creates
`node_modules` for you and there is nothing to do. If it only has a
`deno.json`, ask for one explicitly:

```json
{
  "nodeModulesDir": "auto",
  "imports": {
    "grats": "npm:grats@^0.0.36",
    "graphql": "npm:graphql@^16.11.0"
  }
}
```

### 2. Tell Grats to write `.ts` import specifiers

Deno requires a file extension on relative imports. Grats writes them without
one unless you ask, so the generated `schema.ts` would import `./models/User`
and Deno would refuse to load it:

```
error: Module not found. Maybe add a '.ts' extension
```

Set [`importModuleSpecifierEnding`](https://grats.capt.dev/docs/getting-started/configuration/#importmodulespecifierending)
in `tsconfig.json`:

```json
{
  "grats": {
    "importModuleSpecifierEnding": ".ts"
  }
}
```

## Configuration lives in `tsconfig.json`, not `deno.json`

Grats looks for its options under the `grats` key of a `tsconfig.json`, and
takes the set of files to read from that file's `include`/`files`/`exclude`.
It does not read `deno.json`. A Deno project using Grats therefore keeps a
`tsconfig.json` alongside its `deno.json`, as this example does; Deno ignores
it, and Grats reads only it.

## Running this example

```bash
pnpm install     # from the repository root
pnpm run grats   # regenerate schema.graphql and schema.ts
pnpm start       # serve http://localhost:4000/graphql
```
