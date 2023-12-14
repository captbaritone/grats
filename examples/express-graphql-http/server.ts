import * as express from "express";
import { createHandler } from "graphql-http/lib/use/express";
import { getSchema } from "./schema";

async function main() {
  const app = express();

  app.post(
    "/graphql",
    createHandler({
      schema: getSchema(),
    }),
  );

  app.listen(4000);
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
}

main();
