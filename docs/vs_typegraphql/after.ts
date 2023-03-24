import { PrismaClient } from "@prisma/client";
import express from "express";
import { graphqlHTTP } from "express-graphql";

const prisma = new PrismaClient();

/** @GQLType */
export class User {
  /** @GQLField */
  email: string;

  /** @GQLField */
  name?: string | null;
}

/** @GQLType */
export class Query {
  /** @GQLField */
  async allUsers() {
    return prisma.user.findMany();
  }
}

const schema = buildSchemaSync({
  resolvers: [PostResolver, UserResolver],
});

const app = express();
app.use(
  "/graphql",
  graphqlHTTP({
    schema,
  }),
);
app.listen(4000);
