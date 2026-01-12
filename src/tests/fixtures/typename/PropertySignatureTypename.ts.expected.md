# typename/PropertySignatureTypename.ts

## Input

```ts title="typename/PropertySignatureTypename.ts"
/** @gqlType */
export class User implements IPerson {
  __typename: "User";
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
export interface IPerson {
  /** @gqlField */
  name: string;
}
```

## Output

### SDL

```graphql
interface IPerson {
  name: String
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
    return new GraphQLSchema({
        types: [IPersonType, UserType]
    });
}
```