/** @gqlType */
type Query = unknown;

/** @gqlField */
export function me(_: Query): User {
  return new User();
}

/** @gqlType */
class User {
  /**
   * @gqlField
   * @killsParentOnException
   */
  alwaysThrowsKillsParentOnException(): string {
    // @ts-ignore
    return null;
  }
}

export const query = `
  query {
    me {
      alwaysThrowsKillsParentOnException
    }
  }
`;
