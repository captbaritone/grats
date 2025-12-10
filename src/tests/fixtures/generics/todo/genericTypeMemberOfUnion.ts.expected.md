## input

```ts title="generics/todo/genericTypeMemberOfUnion.ts"
/** @gqlType */
export class User<T> {
  __typename: "User";
  /** @gqlField */
  name: string;

  /** @gqlField */
  friend: T;
}

/** @gqUnion */
type Friendly = User<Dog>;

/** @gqlType */
class Dog {
  /** @gqlField */
  name: string;
}
```

## Output

```
-- SDL --
type Dog {
  name: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const DogType: GraphQLObjectType = new GraphQLObjectType({
        name: "Dog",
        fields() {
            return {
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [DogType]
    });
}
```