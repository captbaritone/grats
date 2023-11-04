import { readFileSync } from "fs";

import * as express from "express";
import { createHandler } from 'graphql-http/lib/use/express';

import { extractGratsSchemaAtRuntime, buildSchemaFromSDL } from "grats";
import Query from "./Query";

async function main() {
  const app = express();

  // FIXME: This is relative to the current working directory, not the file, or
  // something more sensible.
  const schema = getSchema();

  app.post(
    "/graphql",
    createHandler({
      schema: schema,
      rootValue: new Query(),
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
