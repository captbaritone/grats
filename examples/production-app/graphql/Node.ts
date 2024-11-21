import { fromGlobalId, toGlobalId } from "graphql-relay";
import { ID } from "grats";
import { Query } from "./Roots";
import { Ctx } from "../ViewerContext";

/**
 * Converts a globally unique ID into a local ID asserting
 * that the typename matches the expected typename.
 */
export function getLocalTypeAssert(id: ID, typename: string): string {
  const { type, id: localID } = fromGlobalId(id);
  if (type !== typename) {
    throw new Error(`Expected ID of type ${typename}, got ${type}`);
  }
  return localID;
}

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
 * @killsParentOnException */
export function id(node: GraphQLNode): ID {
  return toGlobalId(node.__typename, node.localID());
}

/**
 * Fetch a single `Node` by its globally unique ID.
 * @gqlField */
export async function node(
  _: Query,
  args: { id: ID },
  ctx: Ctx,
): Promise<GraphQLNode | null> {
  const { type, id } = fromGlobalId(args.id);

  // Note: Every type which implements `Node` must be represented here, and
  // there's not currently any static way to enforce that. This is a potential
  // source of bugs.
  switch (type) {
    case "User":
      return ctx.vc.getUserById(id);
    case "Post":
      return ctx.vc.getPostById(id);
    case "Like":
      return ctx.vc.getLikeById(id);
    default:
      throw new Error(`Unknown typename: ${type}`);
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
