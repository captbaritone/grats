import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { GraphQLNode } from "../graphql/Node";
import { Model } from "./Model";
import { Post } from "./Post";
import { Mutation } from "../graphql/Roots";
import { Connection } from "../graphql/Connection";
import { GqlInfo, Int } from "../../../dist/src/Types.js";
import { connectionFromSelectOrCount } from "../graphql/gqlUtils.js";

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
  async posts(
    args: {
      first?: Int | null;
      after?: string | null;
      last?: Int | null;
      before?: string | null;
    },
    info: GqlInfo,
  ): Promise<Connection<Post>> {
    return connectionFromSelectOrCount(
      () => DB.selectPostsWhereAuthor(this.vc, this.row.id),
      () => DB.selectPostsWhereAuthorCount(this.vc, this.row.id),
      args,
      info,
    );
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
