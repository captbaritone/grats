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

/** @gqlInput */
type Entity = {
  description: string;
};

/** @gqlUnion */
type Actor = User | Entity;
