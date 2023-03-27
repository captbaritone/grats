import { PrismaClient } from "@prisma/client";
import express from "express";
import { graphqlHTTP } from "express-graphql";

const prisma = new PrismaClient();

/** @gqlType */
export class User {
  /** @gqlField */
  email: string;

  /** @gqlField */
  name?: string | null;
}

/** @gqlType */
export class Query {
  /** @gqlField */
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
