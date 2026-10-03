# generics/genericFunctionFieldOnInterface.ts

## Input

```ts title="generics/genericFunctionFieldOnInterface.ts"
/** @gqlInterface */
export interface Box<T> {
  /** @gqlField */
  value: T;
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;
}

/** @gqlField */
export function unwrap<T>(box: Box<T>): T {
  return box.value;
}

/** @gqlQueryField */
export function box(): Box<User> {
  return { value: new User() };
}
```

## Output

### SDL

```graphql
interface UserBox {
  unwrap: User
  value: User
}

type Query {
  box: UserBox
}

type User {
  name: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLInterfaceType, GraphQLString } from "graphql";
import { box as queryBoxResolver } from "./genericFunctionFieldOnInterface";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return { name: {
                name: "name",
                type: GraphQLString
            } };
        }
    });
    const UserBoxType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "UserBox",
        fields() {
            return {
                unwrap: {
                    name: "unwrap",
                    type: UserType
                },
                value: {
                    name: "value",
                    type: UserType
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return { box: {
                name: "box",
                type: UserBoxType,
                resolve() {
                    return queryBoxResolver();
                }
            } };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [
            UserBoxType,
            QueryType,
            UserType
        ]
    });
}
```