/** @gqlType */
export class User {
  __typename = 1 as const;
  /** @gqlField */
  name: string = "Alice";
}
