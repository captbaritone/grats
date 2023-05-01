/** @gqlInterface Person */
interface DONT_USE_THIS {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class User implements DONT_USE_THIS {
  __typename = "User";
  /** @gqlField */
  name: string;
}
