# @stream

Grats allows you to define fields which return a single item at a time in order to be compatible with the [`@stream` directive](https://github.com/graphql/graphql-wg/blob/main/rfcs/DeferStream.md). Simply define your field as returning an `AsyncIterable<YourType>`.

## Example

```ts
/** @gqlType */
class Viewer {
  /**
   * An "algorithmically generated" feed of posts.
   *
   * **Note:** Due to the extreme complexity of this algorithm, it can be slow.
   * It is recommended to use `@stream` to avoid blocking the client.
   * @gqlField
   */
  async *feed(_: unknown, ctx: Ctx): AsyncIterable<Post> {
    const rows = await DB.selectPosts(ctx.vc);
    for (const row of rows) {
      // Simulate a slow algorithm
      await new Promise((resolve) => setTimeout(resolve, 500));
      yield new Post(row);
    }
  }
}
```

This field could then be read using a query like this:

```graphql
query ViewerFeedQuery {
  viewer {
    feed @stream {
      id
      title
      content
    }
  }
}
```

See the `Query.feed` field in our [Example Production App](../05-examples/10-production-app.md) for an end to end working example.

## Enabling for your GraphQL Server

:::tip
You will likely need to enable support of `@stream` in your GraphQL server library. See below for an example of enabling `@stream` in Yoga.
:::

```ts
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema";
import { useDeferStream } from "@graphql-yoga/plugin-defer-stream";

const server = createServer(
  createYoga({
    schema: getSchema(),
    plugins: [useDeferStream()],
  }),
);

server.listen(4000, () => {
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
});
```

See the `server.ts` in our [Example Production App](../05-examples/10-production-app.md) for an end to end working example.
