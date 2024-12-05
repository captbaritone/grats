import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { VC } from "./ViewerContext";
import { addGraphQLScalarSerialization } from "./graphql/CustomScalars";
import { useDeferStream } from "@graphql-yoga/plugin-defer-stream";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { getResolverMap } from "./schema";
import path from "node:path";
import fs from "node:fs";

const SDL_PATH = path.join(__dirname, "../schema.graphql");

main();

async function main() {
  const SDL = fs.readFileSync(SDL_PATH, "utf-8");

  const schema = makeExecutableSchema({
    typeDefs: SDL,
    resolvers: getResolverMap(),
  });

  addGraphQLScalarSerialization(schema);

  const yoga = createYoga({
    schema,
    context: () => ({ vc: new VC() }),
    plugins: [useDeferStream()],
  });

  const server = createServer(yoga);

  server.listen(4000, () => {
    console.log(
      "Running a GraphQL API server at http://localhost:4000/graphql",
    );
  });
}
