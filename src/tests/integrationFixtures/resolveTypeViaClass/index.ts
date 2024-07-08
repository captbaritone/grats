import { ID } from "../../../Types";

/** @gqlInterface */
interface GqlNode {
  /** @gqlField */
  id: ID;
}

/** @gqlType */
export class User implements GqlNode {
  constructor(
    /** @gqlField */
    public id: ID,
  ) {}
}

/** @gqlType */
export class Guest implements GqlNode {
  constructor(
    /** @gqlField */
    public id: ID,
  ) {}
}

class AlsoUser extends User {
  constructor(id: ID) {
    super(id);
  }
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function node(_: Query, args: { id: ID }): GqlNode {
  const { id } = args;
  if (id.startsWith("User:")) {
    return new User(id);
  } else if (id.startsWith("Guest:")) {
    return new Guest(id);
  } else if (id.startsWith("AlsoUser:")) {
    return new AlsoUser(id);
  } else {
    return new Guest(id);
  }
}

export const query = /* GraphQL */ `
  query {
    user: node(id: "User:1") {
      __typename
    }
    alsoUser: node(id: "AlsoUser:1") {
      __typename
    }
    guest: node(id: "Guest:1") {
      __typename
    }
  }
`;
