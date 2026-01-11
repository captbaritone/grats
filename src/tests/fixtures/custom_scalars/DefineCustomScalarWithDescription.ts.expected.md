# custom_scalars/DefineCustomScalarWithDescription.ts

## Input

```ts title="custom_scalars/DefineCustomScalarWithDescription.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: string;
}

/**
 * Use this for URLs.
 * @gqlScalar
 */
export type MyUrl = string;
```

## Output

### SDL

```graphql
"""Use this for URLs."""
scalar MyUrl

type SomeType {
  hello: String
}
```

### TypeScript

```ts
import type { GqlScalar } from "grats";
import type { MyUrl as MyUrlInternal } from "./DefineCustomScalarWithDescription";
import { GraphQLSchema, GraphQLScalarType, GraphQLObjectType, GraphQLString } from "graphql";
export type SchemaConfig = {
    scalars: {
        MyUrl: GqlScalar<MyUrlInternal>;
    };
};
export function getSchema(config: SchemaConfig): GraphQLSchema {
    const MyUrlType: GraphQLScalarType = new GraphQLScalarType({
        description: "Use this for URLs.",
        name: "MyUrl",
        ...config.scalars.MyUrl
    });
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
        types: [MyUrlType, SomeTypeType]
    });
}
```