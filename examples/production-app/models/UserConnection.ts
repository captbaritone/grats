import { GqlInfo, Int } from "grats";
import * as DB from "../Database";
import { VC } from "../ViewerContext";
import { User } from "./User";
import { Connection } from "../graphql/Connection";
import { connectionFromSelectOrCount } from "../graphql/gqlUtils.js";

/**
 * Convenience field to get the nodes from a connection.
 * @gqlField */
export function nodes(userConnection: Connection<User>): User[] {
  return userConnection.edges.map((edge) => edge.node);
}

// --- Root Fields ---

/**
 * All users in the system. Note that there is no guarantee of order.
 * @gqlQueryField */
export async function users(
  args: {
    first?: Int | null;
    after?: string | null;
    last?: Int | null;
    before?: string | null;
  },
  vc: VC,
  info: GqlInfo,
): Promise<Connection<User>> {
  return connectionFromSelectOrCount(
    () => DB.selectUsers(vc),
    () => DB.selectUsersCount(vc),
    args,
    info,
  );
}
