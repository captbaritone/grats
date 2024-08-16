import { Int } from "grats";
import { Query, Ctx } from "../gql";
import { Post } from "./Post";

/** @gqlType */
export type User = {
  /** @gqlField */
  id: Int;
  /** @gqlField */
  name: string | null;
  /** @gqlField */
  email: string;
};

/** @gqlField */
export function userById(_: Query, id: Int, { db }: Ctx): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

/** @gqlField */
export function allUsers(_: Query, { db }: Ctx): Promise<User[]> {
  return db.user.findMany();
}

/** @gqlField */
export function posts(user: User, { db }: Ctx): Promise<Post[]> {
  return db.post.findMany({ where: { authorId: user.id } });
}
