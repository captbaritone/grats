import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema";
import { VC } from "./ViewerContext";
import { addGraphQLScalarSerialization } from "./graphql/CustomScalars";
import { useDeferStream } from "@graphql-yoga/plugin-defer-stream";
import { applyCreditLimit } from "./graphql/directives";

let schema = getSchema();
schema = applyCreditLimit(schema);
schema = addGraphQLScalarSerialization(schema);

const yoga = createYoga({
  schema,
  context: () => ({ vc: new VC(), credits: 10 }),
  plugins: [useDeferStream()],
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
});
