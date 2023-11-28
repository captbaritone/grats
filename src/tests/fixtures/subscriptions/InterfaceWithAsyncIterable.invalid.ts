/** @gqlInterface */
export interface NotSubscription {
  /** @gqlField */
  greetings(): AsyncIterable<string>;
}
