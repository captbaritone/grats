import { Int } from "grats";
import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { Query } from "../graphql/Roots";
import { Like } from "./Like";
import { PageInfo } from "./PageInfo";
import { connectionFromArray } from "graphql-relay";

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
): Promise<LikeConnection> {
  const rows = await DB.selectLikes(ctx.vc);
  const likes = rows.map((row) => new Like(row));
  return {
    ...connectionFromArray(likes, args),
    count: likes.length,
  };
}
