# Build Mode

Our [quick start](./01-quick-start.md) guide shows you how to get started with Grats in dev mode. This is the easiest way to get started with Grats, but it can cause a slow startup time. For larger projects, you probably want to use the build mode.

With build mode, you can extract your schema at build time, and then use with zero overhead at runtime. This is the recommended way to use Grats in production.

## Install dependencies

Grats can be used with many different GraphQL servers, but this example uses `graphql-express`.

```bash
npm install express express-graphql grats
```

## Create your server

```ts title="/server.ts"
import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import { buildSchemaFromSDL } from "grats";

/** @gqlType */
class Query {
  /** @gqlField */
  hello(): string {
    return "Hello world!";
  }
}

const app = express();

const sdl = fs.readFileSync("./schema.graphql", "utf8");
const schema = buildSchemaFromSDL(sdl)

app.use(
  "/graphql",
  graphqlHTTP({ schema, rootValue: new Query(), graphiql: true }),
);
app.listen(4000);
console.log("Running a GraphQL API server at http://localhost:4000/graphql");
```

## Extract your schema

:::caution

Grats uses your TypeScript config to for its [configuration](./02-configuration.md) and to know which files to scan, so ensure your project has a `tsconfig.json` file defined.

:::

:::note

You'll need to run this step afer every change to your TypeScript code that affects your schema.

:::

```bash
npx grats --output=./schema.graphql
```

## Start your server

```bash
# Build your projects
npm run tsc
# Run your server
node ./server.js
```

:::tip

For guidance on how to integrate Grats' build mode with your development flow, CI system etc, see our [Workflow Guide](../04-guides/01-workflows.md).

:::