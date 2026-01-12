# custom_scalars/DefineRenamedCustomScalar.ts

## Input

```ts title="custom_scalars/DefineRenamedCustomScalar.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlScalar CustomName */
export type MyUrl = string;
```

## Output

### SDL

```graphql
scalar CustomName

type SomeType {
  hello: String
}
```

### TypeScript

```ts
import type { GqlScalar } from "grats";
import type { MyUrl as CustomNameInternal } from "./DefineRenamedCustomScalar";
import { GraphQLSchema, GraphQLScalarType, GraphQLObjectType, GraphQLString } from "graphql";
export type SchemaConfig = {
    scalars: {
        CustomName: GqlScalar<CustomNameInternal>;
    };
};
export function getSchema(config: SchemaConfig): GraphQLSchema {
    const CustomNameType: GraphQLScalarType = new GraphQLScalarType({
        name: "CustomName",
        ...config.scalars.CustomName
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
        types: [CustomNameType, SomeTypeType]
    });
}
```