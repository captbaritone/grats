import { Int } from "grats";
import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { Query } from "../graphql/Roots";
import { Post } from "./Post";
import { Connection } from "../graphql/Connection";
import { connectionFromArray } from "graphql-relay";

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
): Promise<Connection<Post>> {
  const rows = await DB.selectPosts(ctx.vc);
  const posts = rows.map((row) => new Post(ctx.vc, row));
  return connectionFromArray(posts, args);
}
