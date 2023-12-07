import express from "express";
import { createHandler } from "graphql-http/lib/use/express";
import { Context, GroupService, UserService } from "./context";
import { schema } from "./schema";

async function main() {
  const app = express();

  app.post(
    "/graphql",
    createHandler<Context>({
      schema: schema,
      context() {
        return {
          userService: new UserService(),
          groupService: new GroupService(),
        } satisfies Context;
      },
    }),
  );

  app.listen(4000);
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
}

main();
