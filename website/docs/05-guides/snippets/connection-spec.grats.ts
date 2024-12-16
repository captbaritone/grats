import { Int } from "grats";

/** @gqlField */
export function users(
  _: Query,
  args: {
    first?: Int | null;
    after?: string | null;
    last?: Int | null;
    before?: string | null;
  },
): Connection<User> {
  const users = [{ name: "John" }];
  return connectionFromArray(users, args);
}

/** --- Reusable Connection Types --- */

/** @gqlType */
export type Connection<T> = {
  /** @gqlField */
  edges: Edge<T>[];
  /** @gqlField */
  pageInfo: PageInfo;
};

/** @gqlType */
export type Edge<T> = {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
export type PageInfo = {
  /** @gqlField */
  startCursor: string | null;
  /** @gqlField */
  endCursor: string | null;
  /** @gqlField */
  hasNextPage: boolean;
  /** @gqlField */
  hasPreviousPage: boolean;
};
// trim-start

/** @gqlType */
type Query = unknown;

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

// This function can be found in the module `graphql-relay`.
// Extracted here for example purposes.
declare function connectionFromArray<T>(
  data: ReadonlyArray<T>,
  args: {
    first?: Int | null;
    after?: string | null;
    last?: Int | null;
    before?: string | null;
  },
): Connection<T>;
// trim-end
