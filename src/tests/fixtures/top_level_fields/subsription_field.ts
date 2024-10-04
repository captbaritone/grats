/** @gqlSubscriptionField */
export async function* goodbye(): AsyncIterable<string> {
  yield "Goodbye, World!";
}
