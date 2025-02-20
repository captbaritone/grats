import * as DB from "../Database";
import { VC } from "../ViewerContext";
import { GraphQLNode, getLocalTypeAssert } from "../graphql/Node";
import { User } from "./User";
import { Model } from "./Model";
import { GqlInfo, ID, Int } from "../../../dist/src";
import { GqlDate } from "../graphql/CustomScalars";
import { LikeConnection } from "./LikeConnection";
import { connectionFromSelectOrCount } from "../graphql/gqlUtils.js";

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
   * @gqlField
   * @gqlAnnotate cost(credits: 10) */
  async likes(
    args: {
      first?: Int | null;
      after?: string | null;
      last?: Int | null;
      before?: string | null;
    },
    info: GqlInfo,
  ): Promise<LikeConnection> {
    return connectionFromSelectOrCount(
      () => DB.getLikesForPost(this.vc, this.row.id),
      () => DB.getLikesCountForPost(this.vc, this.row.id),
      args,
      info,
    );
  }
}

// --- Mutations ---

/**
 * Models a node in a Markdown AST
 * @gqlInput
 */
type MarkdownNode =
  | { h1: string }
  | { h2: string }
  | { h3: string }
  | { p: string }
  | { blockquote: string }
  | { ul: string[] }
  | { li: string[] };

/**
 * Post content. Could be pure text, or Markdown
 * @gqlInput
 */
type PostContentInput = { string: string } | { markdown: MarkdownNode[] };

/** @gqlInput */
type CreatePostInput = {
  title: string;
  content: PostContentInput;
  authorId: ID;
};

/** @gqlType */
type CreatePostPayload = {
  /** @gqlField */
  post: Post;
};

// TODO: Use real serialization that handles multiple lines and escapes
// markdown characters.
function serializeMarkdownNode(markdown: MarkdownNode): string {
  switch (true) {
    case "h1" in markdown:
      return `# ${markdown.h1}`;
    case "h2" in markdown:
      return `## ${markdown.h2}`;
    case "h3" in markdown:
      return `### ${markdown.h3}`;
    case "p" in markdown:
      return markdown.p;
    case "blockquote" in markdown:
      return `> ${markdown.blockquote}`;
    case "ul" in markdown:
      return markdown.ul.map((item) => `- ${item}`).join("\n");
    case "li" in markdown:
      return markdown.li.map((item, i) => `${i + 1}. ${item}`).join("\n");
    default: {
      const _exhaustiveCheck: never = markdown;
      throw new Error(`Unexpected markdown node: ${JSON.stringify(markdown)}`);
    }
  }
}

function serializeMarkdown(markdown: MarkdownNode[]): string {
  return markdown.map(serializeMarkdownNode).join("\n");
}

function serializeContent(content: PostContentInput): string {
  switch (true) {
    case "string" in content:
      return content.string;
    case "markdown" in content:
      return serializeMarkdown(content.markdown);
    default: {
      const _exhaustiveCheck: never = content;
      throw new Error(`Unexpected content: ${JSON.stringify(content)}`);
    }
  }
}

/**
 * Create a new post.
 * @gqlMutationField */
export async function createPost(
  input: CreatePostInput,
  vc: VC,
): Promise<CreatePostPayload> {
  const post = await DB.createPost(vc, {
    ...input,
    content: serializeContent(input.content),
    authorId: getLocalTypeAssert(input.authorId, "User"),
  });
  return { post };
}
