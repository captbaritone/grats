/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me: Actor;
}

/** @gqlType */
interface User {
  __typename: "User";
  /** @gqlField */
  name: string;
}

/** @gqlType */
interface Entity {
  __typename: "Entity";
  /** @gqlField */
  description: string;
}

/** @gqlUnion */
type Actor = User | Entity;
