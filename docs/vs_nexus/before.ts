import { PrismaClient } from "@prisma/client";
import { queryType, objectType, makeSchema } from "@nexus/schema";
import express from "express";
import { graphqlHTTP } from "express-graphql";

const prisma = new PrismaClient();

const User = objectType({
  name: "User",
  definition(t) {
    t.string("email");
    t.string("name", { nullable: true });
  },
});

const Query = queryType({
  definition(t) {
    t.list.field("allUsers", {
      type: "User",
      resolve: () => prisma.user.findMany(),
    });
  },
});

const schema = makeSchema({
  types: [User, Query],
});

const app = express();
app.use(
  "/graphql",
  graphqlHTTP({
    schema,
  }),
);

app.listen(4000);
