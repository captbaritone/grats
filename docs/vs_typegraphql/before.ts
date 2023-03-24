import { PrismaClient } from "@prisma/client";
import { ObjectType, Field, ID, buildSchemaSync } from "type-graphql";
import express from "express";
import { graphqlHTTP } from "express-graphql";

const prisma = new PrismaClient();

@ObjectType()
export class User {
  @Field()
  email: string;

  @Field((type) => String, { nullable: true })
  name?: string | null;
}

@Resolver(User)
export class UserResolver {
  @Query((returns) => [User], { nullable: true })
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
