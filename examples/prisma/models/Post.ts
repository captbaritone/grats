import { Int } from "grats";
import { Ctx, Query, Mutation } from "../gql";
import { User } from "./User";

/** @gqlType */
export type Post = {
  /** @gqlField */
  id: Int;
  /** @gqlField */
  title: string;
  /** @gqlField */
  content: string | null;

  // Not exposed
  authorId: number;
};

/** @gqlInput */
type CreatePostInput = {
  title: string;
  content?: string;
};

/** @gqlField */
export async function createPost(
  _: Mutation,
  input: CreatePostInput,
  { db, viewer }: Ctx,
): Promise<Post | null> {
  return db.post.create({ data: { ...input, authorId: viewer.id } });
}

/** @gqlField */
export function postById(_: Query, id: Int, { db }: Ctx): Promise<Post | null> {
  return db.post.findUnique({ where: { id } });
}

/** @gqlField */
export async function allPosts(_: Query, { db }: Ctx): Promise<Post[]> {
  return db.post.findMany();
}

/** @gqlField */
export async function author(post: Post, { db }: Ctx): Promise<User | null> {
  return db.user.findUnique({ where: { id: post.authorId } });
}
