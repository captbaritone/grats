# headers/customHeaders.ts

## Input

```ts title="headers/customHeaders.ts"
// {"schemaHeader": "# Generated SDL", "tsSchemaHeader": "// Generated TS"}
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}
```

## Output

### SDL

```graphql
# Generated SDL

type SomeType {
  hello: String
}
```

### TypeScript

```ts
// Generated TS

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