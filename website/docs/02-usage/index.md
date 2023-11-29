# Usage

Our [quick start](../01-getting-started/01-quick-start.md) guide shows you how to get started with Grats by running extraction at startup time. This is the easiest way to get started with Grats, but it can cause slow startup times. For production use cases, you probably want to extract your schema as a separate build step.

With this approach you have nearly zero overhead at runtime. This is the recommended way to use Grats in production.

## Install dependencies

Grats can be used with many different GraphQL servers, but this example uses `graphql-yoga`. For other examples, see our [examples](../05-examples/index.mdx) section.

```bash
npm install express graphql-yoga grats
```

```bash
npm install --dev typescript
```

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

const app = express();

const sdl = fs.readFileSync("./schema.graphql", "utf8");
const schema = buildSchemaFromSDL(sdl);

const yoga = createYoga({ schema });
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
});
```

For complete documentation of Grat's runtime APIs see the [API Reference](./01-runtime-api.mdx).

## Extract your schema

Use the Grats CLI to extract your schema from your TypeScript code. You'll need to run this step after every change to your TypeScript code that affects your schema.

```bash
npx grats --output=./schema.graphql
```

For complete documentation of Grats' CLI, see the [CLI Reference](./03-cli.md).

## Start your server

```bash
# Build your projects
npm run tsc
# Run your server
node ./server.js
```

🎉 Now that you have your Grats app working, for tips on how to integrate Grats' build mode with your development flow, CI system etc, see our [Workflow Guide](../05-guides/01-workflows.md).
