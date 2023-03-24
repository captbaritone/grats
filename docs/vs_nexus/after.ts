import { PrismaClient } from "@prisma/client";
import express from "express";
import { graphqlHTTP } from "express-graphql";

const prisma = new PrismaClient();

// FIXME: Not supported yet
/** @GQLType */
type User = {
  /** @GQLField */
  email: string;
  /** @GQLField */
  name?: string;
};

/** @GQLType */
class Query {
  allUsers(): Promise<User[]> {
    return prisma.user.findMany();
  }
}

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
