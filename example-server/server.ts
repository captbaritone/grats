import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import Query from "./Query";
import { buildSchema } from "../src";

async function main() {
  const app = express();

  const schema = await buildSchema("./**/Query.ts");

  app.use(
    "/graphql",
    graphqlHTTP({
      schema: schema,
      rootValue: new Query(),
      graphiql: true,
    }),
  );
  app.listen(4000);
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
}

main();
