import { GqlInfo, Int } from "grats";
import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { Query, Subscription } from "../graphql/Roots";
import { Like } from "./Like";
import { PageInfo } from "../graphql/Connection";
import { PubSub } from "../PubSub";
import { filter, map, pipe } from "graphql-yoga";
import { getLocalTypeAssert } from "../graphql/Node";
import { connectionFromSelectOrCount } from "../graphql/gqlUtils.js";

/** @gqlType */
export type LikeConnection = {
  /** @gqlField */
  edges: LikeEdge[];
  /**
   * The total number of likes that post has received.
   * **Note:** This is separate from the number of edges currently being read.
   * @gqlField */
  count: Int;
  /** @gqlField */
  pageInfo: PageInfo;
};

/**
 * Convenience field to get the nodes from a connection.
 * @gqlField */
export function nodes(likeConnection: LikeConnection): Like[] {
  return likeConnection.edges.map((edge) => edge.node);
}

/** @gqlType */
type LikeEdge = {
  /** @gqlField */
  node: Like;
  /** @gqlField */
  cursor: string;
};

// --- Root Fields ---

/**
 * All likes in the system. Note that there is no guarantee of order.
 * @gqlField */
export async function likes(
  _: Query,
  args: {
    first?: Int | null;
    after?: string | null;
    last?: Int | null;
    before?: string | null;
  },
  ctx: Ctx,
  info: GqlInfo,
): Promise<LikeConnection> {
  return connectionFromSelectOrCount(
    () => DB.selectLikes(ctx.vc),
    () => DB.selectLikesCount(ctx.vc),
    args,
    info,
  );
}

/**
 * Subscribe to likes on a post.
 * **Note:** Does not immediately return likes, but rather updates as likes are applied.
 * @gqlField */
export async function postLikes(
  _: Subscription,
  postID: string,
  ctx: Ctx,
  info: GqlInfo,
): Promise<AsyncIterable<LikeConnection>> {
  const id = getLocalTypeAssert(postID, "Post");
  const post = await ctx.vc.getPostById(id);
  return pipe(
    PubSub.subscribe("postLiked"),
    filter((postId) => postId === id),
    map(() => post.likes({}, info)),
  );
}
