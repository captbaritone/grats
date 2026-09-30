# configOptions/emitMetadata.ts

## Input

```ts title="configOptions/emitMetadata.ts"
// {"EXPERIMENTAL__emitMetadata": true}

import { GqlInfo, Int } from "../../../Types";

/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export async function createDerivedContext(
  ctx: RootContext,
): Promise<DerivedContext> {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  /** @gqlField renamedProperty */
  someProperty: string;

  /** @gqlField */
  greet(args: { greeting: string }, ctx: RootContext, info: GqlInfo): string {
    return `${args.greeting}, ${this.name}!`;
  }

  /** @gqlField renamedMethod */
  someMethod(): string {
    return this.name;
  }

  /** @gqlQueryField */
  static allUsers(): User[] {
    return [];
  }
}

/** @gqlField */
export function age(
  user: User,
  offset: Int,
  derived: DerivedContext,
  ctx: RootContext,
): Int {
  return offset;
}

/** @gqlQueryField */
export default function me(): User {
  return new User();
}
```

## Output

### SDL

```graphql
type Query {
  allUsers: [User!]
  me: User
}

type User {
  age(offset: Int!): Int
  greet(greeting: String!): String
  name: String
  renamedMethod: String
  renamedProperty: String
}
```

### TypeScript

```ts
import queryMeResolver from "./emitMetadata";
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLString,
} from "graphql";
import {
  age as userAgeResolver,
  createDerivedContext,
  User as queryAllUsersResolver,
} from "./emitMetadata";
export function getSchema(): GraphQLSchema {
  const UserType: GraphQLObjectType = new GraphQLObjectType({
    name: "User",
    fields() {
      return {
        age: {
          name: "age",
          type: GraphQLInt,
          args: { offset: { type: new GraphQLNonNull(GraphQLInt) } },
          async resolve(source, args, context) {
            return userAgeResolver(
              source,
              args.offset,
              await createDerivedContext(context),
              context,
            );
          },
        },
        greet: {
          name: "greet",
          type: GraphQLString,
          args: { greeting: { type: new GraphQLNonNull(GraphQLString) } },
          resolve(source, args, context, info) {
            return source.greet(args, context, info);
          },
        },
        name: { name: "name", type: GraphQLString },
        renamedMethod: {
          name: "renamedMethod",
          type: GraphQLString,
          resolve(source) {
            return source.someMethod();
          },
        },
        renamedProperty: {
          name: "renamedProperty",
          type: GraphQLString,
          resolve(source) {
            return source.someProperty;
          },
        },
      };
    },
  });
  const QueryType: GraphQLObjectType = new GraphQLObjectType({
    name: "Query",
    fields() {
      return {
        allUsers: {
          name: "allUsers",
          type: new GraphQLList(new GraphQLNonNull(UserType)),
          resolve() {
            return queryAllUsersResolver.allUsers();
          },
        },
        me: {
          name: "me",
          type: UserType,
          resolve() {
            return queryMeResolver();
          },
        },
      };
    },
  });
  return new GraphQLSchema({ query: QueryType, types: [QueryType, UserType] });
}
```

### Metadata

```json
{
  "types": {
    "Query": {
      "allUsers": {
        "resolver": {
          "kind": "staticMethod",
          "path": "grats/src/tests/fixtures/configOptions/emitMetadata.ts",
          "exportName": "User",
          "name": "allUsers",
          "arguments": []
        }
      },
      "me": {
        "resolver": {
          "kind": "function",
          "path": "grats/src/tests/fixtures/configOptions/emitMetadata.ts",
          "exportName": null,
          "arguments": []
        }
      }
    },
    "User": {
      "age": {
        "resolver": {
          "kind": "function",
          "path": "grats/src/tests/fixtures/configOptions/emitMetadata.ts",
          "exportName": "age",
          "arguments": [
            {
              "kind": "source"
            },
            {
              "kind": "named",
              "name": "offset"
            },
            {
              "kind": "derivedContext",
              "path": "grats/src/tests/fixtures/configOptions/emitMetadata.ts",
              "exportName": "createDerivedContext",
              "async": true,
              "args": [
                {
                  "kind": "context"
                }
              ]
            },
            {
              "kind": "context"
            }
          ]
        }
      },
      "greet": {
        "resolver": {
          "kind": "method",
          "name": null,
          "arguments": [
            {
              "kind": "argumentsObject"
            },
            {
              "kind": "context"
            },
            {
              "kind": "information"
            }
          ]
        }
      },
      "name": {
        "resolver": {
          "kind": "property",
          "name": null
        }
      },
      "renamedMethod": {
        "resolver": {
          "kind": "method",
          "name": "someMethod",
          "arguments": []
        }
      },
      "renamedProperty": {
        "resolver": {
          "kind": "property",
          "name": "someProperty"
        }
      }
    }
  }
}
```