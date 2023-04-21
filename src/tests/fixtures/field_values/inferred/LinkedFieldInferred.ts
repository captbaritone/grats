/** @gqlType */
class Query {
  /** @gqlField */
  async me() {
    return getUser();
  }
}

/** @gqlType */
class User {
  /** @gqlField */
  name: string;
}

function getUser(): User {
  return new User();
}
