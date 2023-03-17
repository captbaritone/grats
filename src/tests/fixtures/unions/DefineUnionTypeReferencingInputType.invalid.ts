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

/** @GQLInput */
type Entity = {
  description: string;
};

/** @GQLUnion */
type Actor = User | Entity;
