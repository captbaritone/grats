import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { GraphQLNode, getLocalTypeAssert } from "../graphql/Node";
import { User } from "./User";
import { Model } from "./Model";
import { Mutation } from "../graphql/Roots";
import { ID, Int } from "../../../dist/src";
import { GqlDate } from "../graphql/CustomScalars";
import { LikeConnection } from "./LikeConnection";
import { connectionFromArray } from "graphql-relay";

/**
 * A blog post.
 * @gqlType */
export class Post extends Model<DB.PostRow> implements GraphQLNode {
  __typename = "Post" as const;

  /**
   * The editor-approved title of the post.
   * @gqlField */
  title(): string {
    return this.row.title;
  }

  /**
   * Content of the post in markdown.
   * @gqlField */
  content(): string {
    return this.row.content;
  }

  /**
   * The date and time at which the post was created.
   * @gqlField */
  publishedAt(): GqlDate {
    return this.row.publishedAt;
  }

  /**
   * The author of the post. This cannot change after the post is created.
   * @gqlField */
  async author(): Promise<User> {
    return this.vc.getUserById(this.row.authorId);
  }

  /**
   * All the likes this post has received.
   * **Note:** You can use this connection to access the number of likes.
   * @gqlField */
  async likes(args: {
    first?: Int | null;
    after?: string | null;
    last?: Int | null;
    before?: string | null;
  }): Promise<LikeConnection> {
    const likes = await DB.getLikesForPost(this.vc, this.row.id);
    return {
      ...connectionFromArray(likes, args),
      count: likes.length,
    };
  }
}

// --- Mutations ---

/** @gqlInput */
type CreatePostInput = {
  title: string;
  content: string;
  authorId: ID;
};

/** @gqlType */
type CreatePostPayload = {
  /** @gqlField */
  post: Post;
};

/**
 * Create a new post.
 * @gqlField */
export async function createPost(
  _: Mutation,
  args: { input: CreatePostInput },
  ctx: Ctx,
): Promise<CreatePostPayload> {
  const post = await DB.createPost(ctx.vc, {
    ...args.input,
    authorId: getLocalTypeAssert(args.input.authorId, "User"),
  });
  return { post };
}
