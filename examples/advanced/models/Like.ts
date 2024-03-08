import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { GraphQLNode } from "../graphql/Node";
import { User } from "./User";
import { Model } from "./Model";
import { Mutation } from "../graphql/Roots";
import { ID } from "../../../dist/src";
import { GqlDate } from "../graphql/CustomScalars";
import { Post } from "./Post";

/**
 * A reaction from a user indicating that they like a post.
 * @gqlType */
export class Like extends Model<DB.LikeRow> implements GraphQLNode {
  __typename = "Like";

  /**
   * The date and time at which the post was liked.
   * @gqlField */
  createdAt(): GqlDate {
    return this.row.createdAt;
  }

  /**
   * The user who liked the post.
   * @gqlField */
  async liker(_args: unknown, ctx: Ctx): Promise<User> {
    return new User(await ctx.vc.getUserById(this.row.userId));
  }

  /**
   * The post that was liked.
   * @gqlField */
  async post(_args: unknown, ctx: Ctx): Promise<Post> {
    return new Post(await ctx.vc.getPostById(this.row.postId));
  }
}

// --- Mutations ---

/** @gqlInput */
type CreateLikeInput = {
  postId: ID;
};

/** @gqlType */
type CreateLikePayload = {
  /** @gqlField */
  post: Post;
};

/**
 * Like a post. This action is taken as the currently logged in user.
 * @gqlField */
export async function createLike(
  _: Mutation,
  args: { input: CreateLikeInput },
  ctx: Ctx,
): Promise<CreateLikePayload> {
  // TODO: Decode postId from global ID
  await DB.createLike(ctx.vc, { ...args.input, userId: ctx.vc.userId() });
  return { post: new Post(await ctx.vc.getPostById(args.input.postId)) };
}
