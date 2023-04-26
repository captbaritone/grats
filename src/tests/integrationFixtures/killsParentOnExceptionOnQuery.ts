/** @gqlType */
export class Query {
  /**
   * @gqlField
   * @killsParentOnException
   */
  alwaysThrowsKillsParentOnException(): string {
    throw new Error("This error should kill Query");
  }

  /** @gqlField */
  hello: string = "Hello Worl";
}

export const query = `
  query {
    alwaysThrowsKillsParentOnException
    hello
  }
`;
