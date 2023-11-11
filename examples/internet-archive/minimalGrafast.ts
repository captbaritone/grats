import { createHandler } from "graphql-http/lib/use/express";
import { lambda, GrafastPlans, ExecutableStep, execute } from "grafast";
import { buildSchema } from "graphql";
import * as express from "express";

const expressPlayground =
  require("graphql-playground-middleware-express").default;

const DEFAULT_QUERY = `
# Welcome to the Internet Archive GraphQL API!
query {
  hi
}
`;

async function main() {
  const app = express();
  const sdl = `
  type Query {
    hi: String
  }
  `;

  // Grafast plans

  const schema = buildSchema(sdl);
  // @ts-ignore
  schema.getType("Query").getFields()["hi"].extensions = {
    grafast: {
      plan: (_) => {
        // @ts-ignore
        return lambda([], ([]) => "Hello world");
      },
    },
  };

  app.post(
    "/graphql",
    createHandler({
      schema: schema,
      rootValue: {},
      // @ts-ignore
      execute: execute,
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
