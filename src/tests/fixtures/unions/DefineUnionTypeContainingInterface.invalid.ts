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

/** @gqlInterface */
interface Entity {
  /** @gqlField */
  description: string;
}

/** @gqlUnion */
type Actor = User | Entity;
