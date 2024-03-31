import { connectionFromArray } from "graphql-relay";
import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { GraphQLNode } from "../graphql/Node";
import { Model } from "./Model";
import { Post } from "./Post";
import { Mutation } from "../graphql/Roots";
import { Connection } from "../graphql/Connection";

/** @gqlType */
export class User extends Model<DB.UserRow> implements GraphQLNode {
  __typename = "User" as const;

  /**
   * User's name. **Note:** This field is not guaranteed to be unique.
   * @gqlField */
  name(): string {
    return this.row.name;
  }

  /**
   * All posts written by this user. Note that there is no guarantee of order.
   * @gqlField */
  async posts(): Promise<Connection<Post>> {
    const posts = await DB.selectPostsWhereAuthor(this.vc, this.row.id);
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
  const user = await DB.createUser(ctx.vc, args.input);
  return { user };
}
