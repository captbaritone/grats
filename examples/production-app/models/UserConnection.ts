import { Int } from "grats";
import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { Query } from "../graphql/Roots";
import { User } from "./User";
import { Connection } from "../graphql/Connection";
import { connectionFromArray } from "graphql-relay";

/**
 * Convenience field to get the nodes from a connection.
 * @gqlField */
export function nodes(userConnection: Connection<User>): User[] {
  return userConnection.edges.map((edge) => edge.node);
}

// --- Root Fields ---

/**
 * All users in the system. Note that there is no guarantee of order.
 * @gqlField */
export async function users(
  _: Query,
  args: {
    first?: Int | null;
    after?: string | null;
    last?: Int | null;
    before?: string | null;
  },
  ctx: Ctx,
): Promise<Connection<User>> {
  const rows = await DB.selectUsers(ctx.vc);
  const users = rows.map((row) => new User(row));
  return connectionFromArray(users, args);
}
