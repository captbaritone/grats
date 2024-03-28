/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me: Actor;
}

/** @gqlType */
class User {
  __typename = "User";
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Entity {
  __typename = "Entity";
  /** @gqlField */
  description: string;
}

/** @gqlType */
class Admin {
  __typename = "Admin";
  /** @gqlField */
  description: string;
}

/** @gqlUnion */
type Foo = User | Entity;

/** @gqlUnion */
type Actor = Admin | Foo;
