## input

```ts title="top_level_fields/queryFieldRenamed.ts"
/** @gqlQueryField greeting */
export function greetz(): string {
  return "Hello world";
}
```

## Output

### SDL

```graphql
type Query {
  greeting: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greetz as queryGreetingResolver } from "./queryFieldRenamed";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
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