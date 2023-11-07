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

/** @gqlInput */
type Entity = {
  description: string;
};

/** @gqlUnion */
type Actor = User | Entity;
