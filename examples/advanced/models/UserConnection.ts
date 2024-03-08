import { Int } from "grats";
import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { Query } from "../graphql/Roots";
import { User } from "./User";
import { PageInfo } from "./PageInfo";
import { connectionFromArray } from "graphql-relay";

/** @gqlType */
type UserConnection = {
  /** @gqlField */
  edges: UserEdge[];
  /** @gqlField */
  pageInfo: PageInfo;
};

/**
 * Convenience field to get the nodes from a connection.
 * @gqlField */
export function nodes(userConnection: UserConnection): User[] {
  return userConnection.edges.map((edge) => edge.node);
}

/** @gqlType */
type UserEdge = {
  /** @gqlField */
  node: User;
  /** @gqlField */
  cursor: string;
};

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
): Promise<UserConnection> {
  const rows = await DB.selectUsers(ctx.vc);
  const users = rows.map((row) => new User(row));
  return connectionFromArray(users, args);
}
