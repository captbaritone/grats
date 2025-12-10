## input

```ts title="resolveTypeViaClass/index.ts"
import { ID } from "../../../Types";

/** @gqlInterface */
interface GqlNode {
  /** @gqlField */
  id: ID;
}

/** @gqlType */
export default class DefaultNode implements GqlNode {
  constructor(
    /** @gqlField */
    public id: ID,
  ) {}
}

/** @gqlType */
export class User implements GqlNode {
  constructor(
    /** @gqlField */
    public id: ID,
  ) {}
}

/** @gqlType RenamedNode */
export class ThisNameGetsIgnored implements GqlNode {
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

/** @gqlQueryField */
export function node(args: { id: ID }): GqlNode {
  const { id } = args;
  if (id.startsWith("User:")) {
    return new User(id);
  } else if (id.startsWith("Guest:")) {
    return new Guest(id);
  } else if (id.startsWith("DefaultNode:")) {
    return new DefaultNode(id);
  } else if (id.startsWith("RenamedNode:")) {
    return new ThisNameGetsIgnored(id);
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
    defaultNode: node(id: "DefaultNode:1") {
      __typename
    }
    renamedNode: node(id: "RenamedNode:1") {
      __typename
    }
  }
`;
```

## Output

```
{
  "data": {
    "user": {
      "__typename": "User"
    },
    "alsoUser": {
      "__typename": "User"
    },
    "guest": {
      "__typename": "Guest"
    },
    "defaultNode": {
      "__typename": "DefaultNode"
    },
    "renamedNode": {
      "__typename": "RenamedNode"
    }
  }
}
```