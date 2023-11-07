/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me: Actor;
}

/** @gqlType */
class User {
  /** @gqlField */
  name: string;
}

/** @gqlUnion */
type Actor = User | "LOL";
