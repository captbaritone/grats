/** @gqlType */
export class Query {
  /** @gqlField */
  me(): User {
    return new User();
  }
}

/** @gqlType */
class User {
  /**
   * @gqlField
   * @killsParentOnException
   */
  alwaysThrowsKillsParentOnException(): string {
    throw new Error("This error should kill User");
  }
}

export const query = `
  query {
    me {
      alwaysThrowsKillsParentOnException
    }
  }
`;
