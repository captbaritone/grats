/** @gqlType */
export class User {
  __typename = "User" as const;
  /** @gqlField */
  name: string = "Alice";
}
