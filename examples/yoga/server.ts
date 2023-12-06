import { readFileSync } from "fs";
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";

import { extractGratsSchemaAtRuntime, buildSchemaFromSDL } from "grats";

async function main() {
  const schema = getSchema();

  const yoga = createYoga({
    schema,
  });

  const server = createServer(yoga);

  server.listen(4000, () => {
    console.log(
      "Running a GraphQL API server at http://localhost:4000/graphql",
    );
  });
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
