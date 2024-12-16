import { GqlInfo, Int } from "grats";
import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { Query } from "../graphql/Roots";
import { Post } from "./Post";
import { Connection } from "../graphql/Connection";
import { connectionFromSelectOrCount } from "../graphql/gqlUtils.js";

/**
 * Convenience field to get the nodes from a connection.
 * @gqlField */
export function nodes(userConnection: Connection<Post>): Post[] {
  return userConnection.edges.map((edge) => edge.node);
}

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
  info: GqlInfo,
): Promise<Connection<Post>> {
  return connectionFromSelectOrCount(
    () => DB.selectPosts(ctx.vc),
    () => DB.selectPostsCount(ctx.vc),
    args,
    info,
  );
}
