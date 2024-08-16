import { PrismaClient } from "@prisma/client";
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema";

const prisma = new PrismaClient();

const yoga = createYoga({
  schema: getSchema(),
  context: { db: prisma, viewer: { id: 1 } },
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Running a GraphQL API server at http://localhost:4000/graphql");
});

// TODO: When do I disconnect the Prisma client?
/*
async function main() {
  const user = await prisma.user.create({
    data: {
      name: "Alice",
      email: "alice@prisma.io",
    },
  });
  console.log(user);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

  */
