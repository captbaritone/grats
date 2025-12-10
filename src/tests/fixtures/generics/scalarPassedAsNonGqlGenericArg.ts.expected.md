## input

```ts title="generics/scalarPassedAsNonGqlGenericArg.ts"
/** @gqlType */
type Wrapper<T> = {
  /** @gqlField */
  value: string;
};

/** @gqlType */
type OtherType = {
  /** @gqlField */
  wrapper: Wrapper<string>;
};
```

## Output

### SDL

```graphql
type OtherType {
  wrapper: Wrapper
}

type Wrapper {
  value: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const WrapperType: GraphQLObjectType = new GraphQLObjectType({
        name: "Wrapper",
        fields() {
            return {
                value: {
                    name: "value",
                    type: GraphQLString
                }
            };
        }
    });
    const OtherTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "OtherType",
        fields() {
            return {
                wrapper: {
                    name: "wrapper",
                    type: WrapperType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [OtherTypeType, WrapperType]
    });
}
```