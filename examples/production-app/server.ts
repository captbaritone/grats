import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema.js";
import { VC } from "./ViewerContext.js";
import { scalarConfig } from "./graphql/CustomScalars.js";
import { useDeferStream } from "@graphql-yoga/plugin-defer-stream";

const schema = getSchema({ scalars: scalarConfig });

const yoga = createYoga({
  schema,
  context: () => ({ vc: new VC(), credits: 10 }),
  plugins: [useDeferStream()],
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
});
