import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import { extractGratsSchemaAtRuntime, buildSchemaFromSDL } from "grats";
import { readFileSync } from "fs";

async function main() {
  const app = express();

  const schema = getSchema();

  app.use(
    "/graphql",
    graphqlHTTP({
      schema: schema,
      graphiql: true,
    }),
  );
  app.listen(4000);
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
}

function getSchema() {
  if (process.env.FROM_SDL) {
    console.log("Building schema from SDL...");
    const sdl = readFileSync("./schema.graphql", "utf8");
    return buildSchemaFromSDL(sdl);
  }
  console.log("Building schema from source...");
  return extractGratsSchemaAtRuntime({
    emitSchemaFile: "./schema.graphql",
  });
}

main();
