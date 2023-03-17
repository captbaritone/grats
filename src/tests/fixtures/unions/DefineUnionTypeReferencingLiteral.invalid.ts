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

/** @GQLUnion */
type Actor = User | "LOL";
