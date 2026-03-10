import { GqlInfo, Int } from "grats";
import * as DB from "../Database.js";
import { VC } from "../ViewerContext.js";
import { Post } from "./Post.js";
import { Connection } from "../graphql/Connection.js";
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
 * @gqlQueryField */
export async function posts(
  args: {
    first?: Int | null;
    after?: string | null;
    last?: Int | null;
    before?: string | null;
  },
  vc: VC,
  info: GqlInfo,
): Promise<Connection<Post>> {
  return connectionFromSelectOrCount(
    () => DB.selectPosts(vc),
    () => DB.selectPostsCount(vc),
    args,
    info,
  );
}
