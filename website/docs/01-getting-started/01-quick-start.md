# Quick Start

For dev mode or small projects, Grats offers a runtime extraction mode. This is
the easiest way to get started with Grats, although you may find that it causes
a slow startup times. For larger projects, you probably want to extract your schema at build time. See [Usage](../02-usage/index.md) for more details.

## Install dependencies

Grats can be used with many different GraphQL servers, but this example uses `graphql-yoga`.

```bash https://docusaurus.io/docs/markdown-features/code-blocks#npm2yarn-remark-plugin
npm install express graphql-yoga grats
```

```bash
npm install --dev typescript
```

## Initialize TypeScript

:::caution

Grats uses your TypeScript config to for its [configuration](../02-usage/02-configuration.md) and to know which files to scan, so ensure your project has a `tsconfig.json` file defined.

:::

Create a `tsconfig.json` in your project root:

```json title="/tsconfig.json"
{
  "compilerOptions": {
    "moduleResolution": "node",
    "strictNullChecks": true
  }
}
```

## Create your server

For this quick start example, we'll use `extractGratsSchemaAtRuntime` which will extract your schema at runtime. This is the easiest way to get started with Grats, but it can cause a slow startup time. **For production, we recommend using the [build mode](../02-usage/index.md).**

```ts title="/server.ts"
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { extractGratsSchemaAtRuntime } from "grats";

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function hello(_: Query): string {
  return "Hello world!";
}

// TODO: Switch to buildSchemaFromSDL before using in production
const schema = extractGratsSchemaAtRuntime({
  emitSchemaFile: "./schema.graphql",
});

const yoga = createYoga({ schema });
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
});
```

## Start your server

```bash
# Build your projects
npx tsc
# Run your server. NOTE: This is the generated `.js` file adjacent to your `.ts` file.
node ./server.js
```

## Next steps

Once you have Grats working in your code case, you can proceed to setup for production with the [Runtime API docs](../02-usage/01-runtime-api.mdx), and read about [Workflows](../05-guides/01-workflows.md) to learn how to integrate Grats into your develop ment workflows.
