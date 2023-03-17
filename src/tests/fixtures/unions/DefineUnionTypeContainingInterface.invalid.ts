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

/** @GQLInterface */
interface Entity {
  /** @GQLField */
  description: string;
}

/** @GQLUnion */
type Actor = User | Entity;
