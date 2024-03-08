import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { GraphQLNode } from "../graphql/Node";
import { User } from "./User";
import { Model } from "./Model";
import { Mutation } from "../graphql/Roots";
import { ID } from "../../../dist/src";
import { GqlDate } from "../graphql/CustomScalars";

/**
 * A blog post.
 * @gqlType */
export class Post extends Model<DB.PostRow> implements GraphQLNode {
  __typename = "Post";

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
  async author(_args: unknown, ctx: Ctx): Promise<User> {
    return new User(await ctx.vc.getUserById(this.row.authorId));
  }
}

// --- Mutations ---

/** @gqlInput */
type CreatePostInput = {
  title: string;
  content: string;
  authorId: ID;
  publishedAt: GqlDate;
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
  // TODO: Decode authorId from global ID
  const row = await DB.createPost(ctx.vc, args.input);
  return { post: new Post(row) };
}
