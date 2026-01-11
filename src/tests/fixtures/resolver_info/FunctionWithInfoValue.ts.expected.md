# resolver_info/FunctionWithInfoValue.ts

## Input

```ts title="resolver_info/FunctionWithInfoValue.ts"
import { GqlInfo } from "../../../Types";

/** @gqlField */
export function greetz(_: Query, info: GqlInfo): string {
  return "Hello";
}

/** @gqlType */
type Query = unknown;
```

## Output

### SDL

```graphql
type Query {
  greetz: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greetz as queryGreetzResolver } from "./FunctionWithInfoValue";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greetz: {
                    name: "greetz",
                    type: GraphQLString,
                    resolve(source, _args, _context, info) {
                        return queryGreetzResolver(source, info);
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