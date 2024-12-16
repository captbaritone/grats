import { Int } from "../../../Types";
/** @gqlQueryField */
export function greeting(): string {
  return "Hello world";
}

/** @gqlMutationField */
export function deleteSomething(): string {
  return "Hello world";
}

/** @gqlSubscriptionField */
export async function* range(from: Int): AsyncIterable<Int> {
  for (let i = from; i >= 0; i--) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    yield i;
  }
}
