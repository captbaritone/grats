## input

```ts title="extend_type/addRenamedFieldToSomeType.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField hello */
export function greeting(_: SomeType): string {
  return "Hello world!";
}
```

## Output

```
-- SDL --
type SomeType {
  hello: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as someTypeHelloResolver } from "./addRenamedFieldToSomeType";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    resolve(source) {
                        return someTypeHelloResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```