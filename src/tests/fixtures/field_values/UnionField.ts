/** @GQLType */
export default class Query {
  /** @GQLField */
  me: Actor;
}

/** @GQLType */
class User {
  /** @GQLField */
  name: string;
}

/** @GQLType */
class Entity {
  /** @GQLField */
  description: string;
}

/**
 * @GQLUnion
 */
type Actor = User | Entity;
