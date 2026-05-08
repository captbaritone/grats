import { fromGlobalId, toGlobalId } from "graphql-relay";
import { ID } from "grats";
import { VC } from "../ViewerContext.js";
import { nodeClassMap } from "../schema.js";

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
 * @gqlQueryField */
export async function node(
  args: { id: ID },
  vc: VC,
): Promise<GraphQLNode | null> {
  const { type, id } = fromGlobalId(args.id);
  const cls = nodeClassMap[type as keyof typeof nodeClassMap];
  if (cls == null) {
    throw new Error(`Type "${type}" does not implement Node`);
  }
  return cls.fetchById(vc, id);
}

/**
 * Fetch a list of `Node`s by their globally unique IDs.
 * @gqlQueryField */
export async function nodes(
  ids: ID[],
  vc: VC,
): Promise<Array<GraphQLNode | null>> {
  return Promise.all(ids.map((id) => node({ id }, vc)));
}
