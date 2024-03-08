import { connectionFromArray } from "graphql-relay";
import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { GraphQLNode } from "../graphql/Node";
import { Model } from "./Model";
import { Post } from "./Post";
import { PostConnection } from "./PostConnection";
import { Mutation } from "../graphql/Roots";

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
  async posts(_: unknown, ctx: Ctx): Promise<PostConnection> {
    const rows = await DB.selectPostsWhereAuthor(ctx.vc, this.row.id);
    const posts = rows.map((row) => new Post(row));
    return connectionFromArray(posts, {});
  }
}

// --- Mutations ---

/** @gqlInput */
type CreateUserInput = {
  name: string;
};

/** @gqlType */
type CreateUserPayload = {
  /** @gqlField */
  user: User;
};

/**
 * Create a new user.
 * @gqlField */
export async function createUser(
  _: Mutation,
  args: { input: CreateUserInput },
  ctx: Ctx,
): Promise<CreateUserPayload> {
  const row = await DB.createUser(ctx.vc, args.input);
  return { user: new User(row) };
}
