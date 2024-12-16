/** @gqlQueryField */
export function me(): User {
  return new User();
}

/** @gqlType */
class User {
  /** @gqlField */
  get hello(): string {
    return "Hello world!";
  }
}

export const query = `
  query {
    me {
      hello
    }
  }`;
