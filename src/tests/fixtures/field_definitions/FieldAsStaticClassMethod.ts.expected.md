# field_definitions/FieldAsStaticClassMethod.ts

## Input

```ts title="field_definitions/FieldAsStaticClassMethod.ts"
/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  static getUser(_: Query): User {
    return new User();
  }
}

/** @gqlType */
type Query = unknown;
```

## Output

### SDL

```graphql
type Query {
  getUser: User
}

type User {
  name: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { User as queryGetUserResolver } from "./FieldAsStaticClassMethod";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                getUser: {
                    name: "getUser",
                    type: UserType,
                    resolve(source) {
                        return queryGetUserResolver.getUser(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType, UserType]
    });
}
```