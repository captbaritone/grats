import { Int } from "grats";

/** @gqlSubscriptionField */
export async function* countdown(args: { from: Int }): AsyncIterable<Int> {
  for (let i = args.from; i >= 0; i--) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    yield i;
  }
}
