# type_definitions_from_interface/InterfaceTypeImplementsInterface.ts

## Input

```ts title="type_definitions_from_interface/InterfaceTypeImplementsInterface.ts"
/** @gqlType */
export default interface User extends HasName {
  __typename: "User";
  /** @gqlField */
  hello: string;

  /** @gqlField */
  name: string;
}

/** @gqlInterface */
interface HasName {
  /** @gqlField */
  name: string;
}
```

## Output

### SDL

```graphql
interface HasName {
  name: String
}

type User implements HasName {
  hello: String
  name: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const HasNameType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "HasName",
        fields() {
            return {
                name: {
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
                hello: {
                    name: "hello",
                    type: GraphQLString
                },
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        },
        interfaces() {
            return [HasNameType];
        }
    });
    return new GraphQLSchema({
        types: [HasNameType, UserType]
    });
}
```