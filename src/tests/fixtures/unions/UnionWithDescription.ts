/** @GQLType */
export default class Query {
  /** @GQLField */
  me: Actor;
}

/** @GQLType */
class User {
  __typename = "User";
  /** @GQLField */
  name: string;
}

/** @GQLType */
class Entity {
  __typename = "Entity";
  /** @GQLField */
  description: string;
}

/**
 * One type to rule them all, and in a union bind them.
 * @GQLUnion
 */
type Actor = User | Entity;
