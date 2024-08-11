import {
  Connection,
  ConnectionArguments,
  connectionFromArray,
} from "graphql-relay";
import { GqlInfo } from "grats";

/**
 * Implements an optimization where if the user only reads the `count` field, of
 * a connection, we can perform a cheaper query.
 */
export async function connectionFromSelectOrCount<T>(
  select: () => Promise<ReadonlyArray<T>>,
  count: () => Promise<number>,
  args: ConnectionArguments,
  info: GqlInfo,
): Promise<Connection<T> & { count: number }> {
  if (onlyOneChildField(info, "count")) {
    // Technically a lie since we return an empty array, but we know only the
    // count is being read.
    return { ...connectionFromArray([], args), count: await count() };
  }
  const items = await select();
  return { ...connectionFromArray(items, args), count: items.length };
  //
}

// Checks if only the given field is being requested as a child of the current field
export function onlyOneChildField(info: GqlInfo, onlyField: string): boolean {
  const thisField = info.fieldNodes.find(
    (field) => field.name.value === info.fieldName,
  );
  const selections = thisField?.selectionSet?.selections;
  if (!selections || selections.length !== 1) return false;
  return (
    selections[0].kind === "Field" && selections[0].name.value === onlyField
  );
}
