## input

```ts title="type_definitions/TypeFromClassDefinitionImplementsInterface.ts"
/** @gqlInterface */
interface Person {
  /** @gqlField */
  hello: string;
}

/** @gqlType */
export default class User implements Person {
  readonly __typename = "User" as const;
  /** @gqlField */
  hello: string;
}
```

## Output

### SDL

```graphql
interface Person {
  hello: String
}

type User implements Person {
  hello: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const PersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Person",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString
                }
            };
        }
    });
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString
                }
            };
        },
        interfaces() {
            return [PersonType];
        }
    });
    return new GraphQLSchema({
        types: [PersonType, UserType]
    });
}
```