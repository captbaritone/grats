import { Int } from "grats";

/** @gqlType */
export type Query = unknown;

/** @gqlType */
export type Mutation = unknown;

/** @gqlType */
export type Subscription = unknown;

/** @gqlField */
export async function* countdown(_: Subscription): AsyncIterable<Int> {
  for (let i = 10; i >= 0; i--) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    yield i;
  }
}
