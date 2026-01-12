# type_definitions_from_alias/QueryAsAliasOfUnknown.ts

## Input

```ts title="type_definitions_from_alias/QueryAsAliasOfUnknown.ts"
/** @gqlType */
type Query = unknown;

/** @gqlField */
export function foo(_: Query): string {
  return "foo";
}
```

## Output

### SDL

```graphql
type Query {
  foo: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { foo as queryFooResolver } from "./QueryAsAliasOfUnknown";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                foo: {
                    name: "foo",
                    type: GraphQLString,
                    resolve(source) {
                        return queryFooResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType]
    });
}
```