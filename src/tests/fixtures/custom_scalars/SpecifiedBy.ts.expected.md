## input

```ts title="custom_scalars/SpecifiedBy.ts"
/**
 * @gqlScalar
 * @gqlAnnotate specifiedBy(url: "https://tools.ietf.org/html/rfc4122")
 */
export type UUID = string;
```

## Output

### SDL

```graphql
scalar UUID @specifiedBy(url: "https://tools.ietf.org/html/rfc4122")
```

### TypeScript

```ts
import type { GqlScalar } from "grats";
import type { UUID as UUIDInternal } from "./SpecifiedBy";
import { GraphQLSchema, GraphQLScalarType } from "graphql";
export type SchemaConfig = {
    scalars: {
        UUID: GqlScalar<UUIDInternal>;
    };
};
export function getSchema(config: SchemaConfig): GraphQLSchema {
    const UUIDType: GraphQLScalarType = new GraphQLScalarType({
        specifiedByURL: "https://tools.ietf.org/html/rfc4122",
        name: "UUID",
        ...config.scalars.UUID
    });
    return new GraphQLSchema({
        types: [UUIDType]
    });
}
```