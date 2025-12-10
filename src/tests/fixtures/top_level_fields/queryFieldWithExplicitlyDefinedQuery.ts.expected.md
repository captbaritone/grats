## input

```ts title="top_level_fields/queryFieldWithExplicitlyDefinedQuery.ts"
/** @gqlQueryField */
export function greeting(): string {
  return "Hello world";
}

/**
 * I might want to explicitly define a type here to provide a description.
 *
 * @gqlType */
export type Query = unknown;
```

## Output

### SDL

```graphql
"""
I might want to explicitly define a type here to provide a description.
"""
type Query {
  greeting: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as queryGreetingResolver } from "./queryFieldWithExplicitlyDefinedQuery";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        description: "I might want to explicitly define a type here to provide a description.",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve() {
                        return queryGreetingResolver();
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