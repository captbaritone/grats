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

/** @gqlUnion */
type Actor = User | Entity | Actor;
