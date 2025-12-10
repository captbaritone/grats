## input

```ts title="field_definitions/GetAcessorField.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  get hello(): string {
    return "Hello world!";
  }
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
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```