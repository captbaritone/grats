/** @gqlType */
export default class Query {
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
