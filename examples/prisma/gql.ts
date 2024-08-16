import { PrismaClient } from "@prisma/client";

/** @gqlContext */
export type Ctx = {
  db: PrismaClient;
  viewer: { id: number };
};

/** @gqlType */
export type Query = unknown;

/** @gqlType */
export type Mutation = unknown;
