/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me: Actor;
}

/** @gqlType */
class User {
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Entity {
  __typename = "Entity" as const;
  /** @gqlField */
  description: string;
}

/** @gqlType */
class Admin {
  __typename = "Admin" as const;
  /** @gqlField */
  description: string;
}

/** @gqlUnion */
type Foo = User | Entity;

/** @gqlUnion */
type Actor = Admin | Foo;
