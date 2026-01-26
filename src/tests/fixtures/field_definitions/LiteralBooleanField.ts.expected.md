# field_definitions/LiteralBooleanField.ts

## Input

```ts title="field_definitions/LiteralBooleanField.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): true {
    return true;
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  hello: Boolean
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLBoolean } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLBoolean
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```