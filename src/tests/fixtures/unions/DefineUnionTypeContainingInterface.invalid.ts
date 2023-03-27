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

/** @gqlInterface */
interface Entity {
  /** @gqlField */
  description: string;
}

/** @gqlUnion */
type Actor = User | Entity;
