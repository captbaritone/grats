import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema";
import SchemaBuilder from "@pothos/core";
import AddGraphQLPlugin from "@pothos/plugin-add-graphql";
import { PothosUserSchemaTypes } from "./pothosTypes";
import User from "./models/User";

const builder = new SchemaBuilder<PothosUserSchemaTypes>({
  plugins: [AddGraphQLPlugin],
  add: { schema: getSchema() },
  // Pothos + Grats' generated PothosUserSchemaTypes ensure this matches
  // the value in Grats config.
  defaultFieldNullability: true,
});

builder.queryType({
  fields: (t) => ({
    pothosAllUsers: t.field({
      type: ["User"],
      resolve: () => {
        return User.allUsers();
      },
    }),
  }),
});

const yoga = createYoga({
  schema: builder.toSchema(),
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
});
