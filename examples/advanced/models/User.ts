import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { GraphQLNode } from "../graphql/Node";
import { Query } from "../graphql/Roots";
import { Model } from "./Model";
import { Post } from "./Post";

/** @gqlType */
export class User extends Model<DB.UserRow> implements GraphQLNode {
  __typename = "User";

  /**
   * User's name. **Note:** This field is not guaranteed to be unique.
   * @gqlField */
  name(): string {
    return this.row.name;
  }

  /**
   * All posts written by this user. Note that there is no guarantee of order.
   * @gqlField */
  async posts(_: unknown, ctx: Ctx): Promise<Post[]> {
    const rows = await DB.selectPostsWhereAuthor(ctx.vc, this.row.id);
    return rows.map((row) => new Post(row));
  }
}

// --- Root Fields ---

/**
 * All users in the system. Note that there is no guarantee of order.
 * @gqlField */
export async function users(_: Query, __: unknown, ctx: Ctx): Promise<User[]> {
  const rows = await DB.selectUsers(ctx.vc);
  return rows.map((row) => new User(row));
}
