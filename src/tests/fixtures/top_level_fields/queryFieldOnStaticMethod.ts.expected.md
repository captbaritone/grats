# top_level_fields/queryFieldOnStaticMethod.ts

## Input

```ts title="top_level_fields/queryFieldOnStaticMethod.ts"
export class SomeNonGraphQLClass {
  /** @gqlQueryField */
  static greeting(): string {
    return "Hello world";
  }
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
import { SomeNonGraphQLClass as queryGreetingResolver } from "./queryFieldOnStaticMethod";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve() {
                        return queryGreetingResolver.greeting();
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