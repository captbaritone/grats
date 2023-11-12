import { readFileSync } from "fs";
import { join as pathJoin } from 'path'

import express from "express";
import { createHandler } from 'graphql-http/lib/use/express';

import { extractGratsSchemaAtRuntime, buildSchemaFromSDL } from "grats";
import { Context, UserService } from "./context";

async function main() {
  const app = express();

  const schema = getSchema();

  app.post(
    "/graphql",
    createHandler<Context>({
      schema: schema,
      rootValue: null,
      context() {
        return {
          userService: new UserService()
        } satisfies Context;
      }
    }),
  );

  app.listen(4000);
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
}

function getSchema() {
  const schemaFilename = pathJoin(__dirname, './schema.graphql');
  if (process.env.FROM_SDL) {
    console.log("Building schema from SDL...");
    const sdl = readFileSync(schemaFilename, "utf8");
    return buildSchemaFromSDL(sdl);
  }
  console.log("Building schema from source...");
  return extractGratsSchemaAtRuntime({
    emitSchemaFile: schemaFilename,
  });
}

main();
