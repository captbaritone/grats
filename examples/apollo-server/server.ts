import { readFileSync } from "fs";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

import { extractGratsSchemaAtRuntime, buildSchemaFromSDL } from "grats";

async function main() {
  const schema = getSchema();

  const server = new ApolloServer({ schema });

  // Passing an ApolloServer instance to the `startStandaloneServer` function:
  //  1. creates an Express app
  //  2. installs your ApolloServer instance as middleware
  //  3. prepares your app to handle incoming requests
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
  });

  console.log(`Running a GraphQL API server at ${url}`);
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
