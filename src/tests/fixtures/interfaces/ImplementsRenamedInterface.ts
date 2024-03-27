/** @gqlInterface Person */
interface DONT_USE_THIS {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class User implements DONT_USE_THIS {
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}
