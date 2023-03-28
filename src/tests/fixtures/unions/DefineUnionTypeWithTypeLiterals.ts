/** @gqlType */
export default class Query {
  /** @gqlField */
  me: Actor;
}

/** @gqlType */
type User = {
  __typename: "User";
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Entity = {
  __typename: "Entity";
  /** @gqlField */
  description: string;
};

/** @gqlUnion */
type Actor = User | Entity;
