import { ID } from "grats";
import { Query } from "./Roots";
import { Ctx } from "../ViewerContext";
import { User } from "../models/User";
import { Post } from "../models/Post";

/**
 * Indicates a stable refetchable object in the system.
 * @gqlInterface Node */
export interface GraphQLNode {
  __typename: string;
  localID(): string;
}

/**
 * A globally unique opaque identifier for a node. Can be used to fetch the the
 * node with the `node` or `nodes` fields.
 *
 * See: https://graphql.org/learn/global-object-identification/
 *
 * @gqlField
 * @killsParentOnExceptions */
export function id(node: GraphQLNode): ID {
  return encodeID(node.__typename, node.localID());
}

/**
 * Fetch a single `Node` by its globally unique ID.
 * @gqlField */
export async function node(
  _: Query,
  args: { id: ID },
  ctx: Ctx,
): Promise<GraphQLNode | null> {
  const { typename, localID } = decodeID(args.id);

  // Note: Every type which implements `Node` must be represented here, and
  // there's not currently any static way to enforce that. This is a potential
  // source of bugs.
  switch (typename) {
    case "User":
      return new User(await ctx.vc.getUserById(localID));
    case "Post":
      return new Post(await ctx.vc.getPostById(localID));
    default:
      throw new Error(`Unknown typename: ${typename}`);
  }
}

/**
 * Fetch a list of `Node`s by their globally unique IDs.
 * @gqlField */
export async function nodes(
  _: Query,
  args: { ids: ID[] },
  ctx: Ctx,
): Promise<Array<GraphQLNode | null>> {
  return Promise.all(args.ids.map((id) => node(_, { id }, ctx)));
}

export function encodeID(typename: string, id: string): ID {
  return btoa(typename + ":" + id);
}

export function decodeID(id: ID): { typename: string; localID: string } {
  const [typename, localID] = atob(id).split(":");
  return { typename, localID };
}
