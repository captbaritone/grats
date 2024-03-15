import { Int } from "grats";
import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { Query } from "../graphql/Roots";
import { Post } from "./Post";
import { PageInfo } from "./PageInfo";
import { connectionFromArray } from "graphql-relay";

/** @gqlType */
export type PostConnection = {
  /** @gqlField */
  edges: PostEdge[];
  /** @gqlField */
  pageInfo: PageInfo;
};

/**
 * Convenience field to get the nodes from a connection.
 * @gqlField */
export function nodes(userConnection: PostConnection): Post[] {
  return userConnection.edges.map((edge) => edge.node);
}

/** @gqlType */
type PostEdge = {
  /** @gqlField */
  node: Post;
  /** @gqlField */
  cursor: string;
};

// --- Root Fields ---

/**
 * All posts in the system. Note that there is no guarantee of order.
 * @gqlField */
export async function posts(
  _: Query,
  args: {
    first?: Int | null;
    after?: string | null;
    last?: Int | null;
    before?: string | null;
  },
  ctx: Ctx,
): Promise<PostConnection> {
  const rows = await DB.selectPosts(ctx.vc);
  const posts = rows.map((row) => new Post(row));
  return connectionFromArray(posts, args);
}
