/** @gqlType */
export class User {
  __typename = "User" as Foo;
  /** @gqlField */
  name: string = "Alice";
}

type Foo = string;
