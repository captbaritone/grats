import { extractGratsSchemaAtRuntime, applyServerDirectives } from "grats";
import { createHandler } from "graphql-http/lib/use/express";
import { readFileSync } from "fs";
import {
  execute,
  lambda,
  makeGrafastSchema,
  GrafastPlans,
  ExecutableStep,
  FieldArgs,
} from "grafast";
import * as express from "express";

const expressPlayground =
  require("graphql-playground-middleware-express").default;

const DEFAULT_QUERY = `
# Welcome to the Internet Archive GraphQL API!
query {
  searchItems(query: "winamp", first: 10) {
    nodes {
      title
      identifier
      url
      collections {
        identifier
        url
      }
    }
  }
}
`;

async function main() {
  const app = express();

  // Force rebuilding the schema at runtime for now.
  const schema = extractGratsSchemaAtRuntime({
    emitSchemaFile: "./schema.graphql",
  });

  console.log("Building schema from SDL...");
  /*
  let sdl = readFileSync("./schema.graphql", "utf8");

  // Add Grafast plan fields
  sdl += `
  extend type Query {
    add(a: Int!, b: Int!): Int!
  }
  `;

  // Grafast plans
  const plans: GrafastPlans = {
    Query: {
      add(_, fieldArgs: FieldArgs): ExecutableStep<number> {
        const $a = fieldArgs.get("a");
        const $b = fieldArgs.get("b");
        return lambda([$a, $b], ([a, b]) => a + b);
      },
    },
  };
  const rawSchema = makeGrafastSchema({ typeDefs: sdl, plans });

  // Apply Grats directives (insert resolver functions/methods)
  // const schema = applyServerDirectives(rawSchema);
  */

  app.post(
    "/graphql",
    createHandler({
      schema: schema,
      rootValue: {},
      // @ts-ignore
      // execute: execute,
    })
  );

  app.get(
    "/graphql",
    expressPlayground({
      endpoint: "/graphql",
      defaultQuery: DEFAULT_QUERY,
      title: "Internet Archive GraphQL API (unofficial)",
    })
  );

  app.listen(4000);
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
}

main();
