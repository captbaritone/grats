import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import Query from "./Query";
import { extractGratsSchemaAtRuntime, buildSchemaFromSDL } from "../src";

async function main() {
  const app = express();

  // FIXME: This is relative to the current working directory, not the file, or
  // something more sensible.

  const schema = getSchema();

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

function getSchema() {
  if (process.env.FROM_SDL) {
    console.log("Building schema from SDL...");
    return buildSchemaFromSDL("./example-server/schema.graphql");
  }
  console.log("Building schema from source...");
  return extractGratsSchemaAtRuntime({
    emitSchemaFile: "./example-server/schema.graphql",
  });
}

main();
