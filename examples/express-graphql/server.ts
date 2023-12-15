import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import { getSchema } from "./schema";

async function main() {
  const app = express();

  app.use(
    "/graphql",
    graphqlHTTP({
      schema: getSchema(),
      graphiql: true,
    }),
  );
  app.listen(4000);
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
}

main();
