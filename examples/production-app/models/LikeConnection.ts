import { GqlInfo, Int } from "grats";
import * as DB from "../Database";
import { VC } from "../ViewerContext";
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
 * @gqlQueryField
 * @gqlAnnotate cost(credits: 10) */
export async function likes(
  args: {
    first?: Int | null;
    after?: string | null;
    last?: Int | null;
    before?: string | null;
  },
  vc: VC,
  info: GqlInfo,
): Promise<LikeConnection> {
  return connectionFromSelectOrCount(
    () => DB.selectLikes(vc),
    () => DB.selectLikesCount(vc),
    args,
    info,
  );
}

/**
 * Subscribe to likes on a post.
 * **Note:** Does not immediately return likes, but rather updates as likes are applied.
 * @gqlSubscriptionField */
export async function postLikes(
  postID: string,
  vc: VC,
  info: GqlInfo,
): Promise<AsyncIterable<LikeConnection>> {
  const id = getLocalTypeAssert(postID, "Post");
  const post = await vc.getPostById(id);
  return pipe(
    PubSub.subscribe("postLiked"),
    filter((postId) => postId === id),
    map(() => post.likes({}, info)),
  );
}
