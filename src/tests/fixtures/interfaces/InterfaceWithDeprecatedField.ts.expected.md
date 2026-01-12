# interfaces/InterfaceWithDeprecatedField.ts

## Input

```ts title="interfaces/InterfaceWithDeprecatedField.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me(): User {
    return new User();
  }
}

/** @gqlInterface */
interface IPerson {
  /** @gqlField
   * @deprecated Not used anymore
   */
  name?: string;
}

/** @gqlType */
class User implements IPerson {
  __typename = "User" as const;
  /** @gqlField */
  name?: string;
}
```

## Output

### SDL

```graphql
interface IPerson {
  name: String @deprecated(reason: "Not used anymore")
}

type SomeType {
  me: User
}

type User implements IPerson {
  name: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const IPersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "IPerson",
        fields() {
            return {
                name: {
                    deprecationReason: "Not used anymore",
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        },
        interfaces() {
            return [IPersonType];
        }
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                me: {
                    name: "me",
                    type: UserType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [IPersonType, SomeTypeType, UserType]
    });
}
```