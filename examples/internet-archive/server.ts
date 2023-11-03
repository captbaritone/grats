import { extractGratsSchemaAtRuntime, buildSchemaFromSDL } from "grats";
import { readFileSync } from "fs";
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";

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
  // FIXME: This is relative to the current working directory, not the file, or
  // something more sensible.

  const schema = getSchema();
  // Create a Yoga instance with a GraphQL schema.
  const yoga = createYoga({
    logging: true,
    graphiql: {
      defaultQuery: DEFAULT_QUERY,
      title: "Internet Archive GraphQL API (unofficial)",
    },
    schema,
  });

  // Pass it into a server to hook into request handlers.
  const server = createServer(yoga);

  // Start the server and you're done!
  server.listen(4000, () => {
    console.info("Server is running on http://localhost:4000/graphql");
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
