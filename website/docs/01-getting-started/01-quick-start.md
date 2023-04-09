# Quick Start

For dev mode or small projects, Grats offers a runtime extraction mode. This is
the easiest way to get started with Grats, although you may find that it causes
a slow startup times. For larger projects, you probably want to use the build
mode (documentation to come).

## Install dependencies

Grats can be used with many different GraphQL servers, but this example uses `graphql-express`.

```bash https://docusaurus.io/docs/markdown-features/code-blocks#npm2yarn-remark-plugin
npm install express express-graphql grats
```

## Create your server

For this quick start example, we'll use `extractGratsSchemaAtRuntime` which will extract your schema at runtime. This is the easiest way to get started with Grats, but it can cause a slow startup time. **For production, we recommend using the [build mode](../02-usage/index.md).**

```ts title="/server.ts"
import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import { extractGratsSchemaAtRuntime } from "grats";

/** @gqlType */
class Query {
  /** @gqlField */
  hello(): string {
    return "Hello world!";
  }
}

const app = express();

// TODO: Switch to buildSchemaFromSDL before using in production
const schema = extractGratsSchemaAtRuntime({
  emitSchemaFile: "./schema.graphql",
});

app.use(
  "/graphql",
  graphqlHTTP({ schema, rootValue: new Query(), graphiql: true }),
);
app.listen(4000);
console.log("Running a GraphQL API server at http://localhost:4000/graphql");
```

## Start your server

:::caution

Grats uses your TypeScript config to for its [configuration](../02-usage/02-configuration.md) and to know which files to scan, so ensure your project has a `tsconfig.json` file defined.

:::

```bash
# Build your projects
npm run tsc
# Run your server
node ./server.js
```

## Next steps

Once you have Grats working in your code case, you can proceed to setup for production with the [Runtime API docs](../02-usage/01-runtime-api.mdx), and read about [Workflows](../05-guides/01-workflows.md) to learn how to integrate Grats into your develop ment workflows.