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

/**
 * @gqlUnion
 */
type Actor = User | Entity;
