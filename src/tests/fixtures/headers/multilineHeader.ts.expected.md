## input

```ts title="headers/multilineHeader.ts"
// {"schemaHeader": ["# Generated SDL\n", "# multi-line"], "tsSchemaHeader": ["// Generated TS\n", "// multi-line"]}
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

# multi-line

type SomeType {
  hello: String
}
```

### TypeScript

```ts
// Generated TS

// multi-line

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