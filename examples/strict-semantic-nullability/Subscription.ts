import { Int } from "grats";

/** @gqlSubscriptionField */
export async function* countdown(args: { from: Int }): AsyncIterable<Int> {
  for (let i = args.from; i >= 0; i--) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    yield i;
  }
}

// All of these should result in an error. Used for validating semantic nullability runtime validation.

/** @gqlSubscriptionField */
export async function* nullItems(): AsyncIterable<string> {
  const empty: string[] = [];
  while (true) {
    yield empty[0];
  }
}

/** @gqlSubscriptionField */
export function nullIterable(): AsyncIterable<string> {
  // @ts-ignore
  return null;
}
