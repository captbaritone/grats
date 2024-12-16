import { Int } from "grats";

/** @gqlType */
export type Subscription = unknown;

/** @gqlField */
export async function* countdown(
  _: Subscription,
  args: { from: Int },
): AsyncIterable<Int> {
  for (let i = args.from; i >= 0; i--) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    yield i;
  }
}

// All of these should result in an error. Used for validating semantic nullability runtime validation.

/** @gqlField */
export async function* nullItems(_: Subscription): AsyncIterable<string> {
  const empty: string[] = [];
  while (true) {
    yield empty[0];
  }
}

/** @gqlField */
export function nullIterable(_: Subscription): AsyncIterable<string> {
  // @ts-ignore
  return null;
}
