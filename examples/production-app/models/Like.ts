import * as DB from "../Database";
import { VC } from "../ViewerContext";
import { GraphQLNode, getLocalTypeAssert } from "../graphql/Node";
import { User } from "./User";
import { Model } from "./Model";
import { ID } from "../../../dist/src";
import { GqlDate } from "../graphql/CustomScalars";
import { Post } from "./Post";

/**
 * A reaction from a user indicating that they like a post.
 * @gqlType */
export class Like extends Model<DB.LikeRow> implements GraphQLNode {
  __typename = "Like" as const;

  /**
   * The date and time at which the post was liked.
   * @gqlField */
  createdAt(): GqlDate {
    return this.row.createdAt;
  }

  /**
   * The user who liked the post.
   * @gqlField */
  async liker(): Promise<User> {
    return this.vc.getUserById(this.row.userId);
  }

  /**
   * The post that was liked.
   * @gqlField */
  async post(): Promise<Post> {
    return this.vc.getPostById(this.row.postId);
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
 * @gqlMutationField */
export async function createLike(
  input: CreateLikeInput,
  vc: VC,
): Promise<CreateLikePayload> {
  const id = getLocalTypeAssert(input.postId, "Post");
  await DB.createLike(vc, {
    ...input,
    userId: vc.userId(),
    postId: id,
  });
  return { post: await vc.getPostById(id) };
}
