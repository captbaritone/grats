import { Int } from "grats";

/** @gqlType */
export type Subscription = unknown;

/** @gqlField */
export async function* countdown(
  _: Subscription,
  args: { from: Int },
): AsyncGenerator<Int> {
  for (let i = args.from; i >= 0; i--) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    yield i;
  }
}
