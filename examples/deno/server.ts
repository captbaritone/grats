import { createHandler } from "graphql-http/lib/use/fetch";
import { getSchema } from "./schema.ts";

const handler = createHandler({ schema: getSchema() });

Deno.serve(
  {
    port: 4000,
    onListen() {
      // The example test runner waits for the server to log before querying it.
      console.log(
        "Running a GraphQL API server at http://localhost:4000/graphql",
      );
    },
  },
  (request) => {
    const { pathname } = new URL(request.url);
    if (pathname !== "/graphql") {
      return new Response("Not found", { status: 404 });
    }
    return handler(request);
  },
);
