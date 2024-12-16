/** @gqlQueryField */
export function me(): User {
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
