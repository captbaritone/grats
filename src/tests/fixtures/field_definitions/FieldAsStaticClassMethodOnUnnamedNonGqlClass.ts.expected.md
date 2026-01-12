# field_definitions/FieldAsStaticClassMethodOnUnnamedNonGqlClass.ts

## Input

```ts title="field_definitions/FieldAsStaticClassMethodOnUnnamedNonGqlClass.ts"
export default class {
  /** @gqlField */
  static greet(_: Query): string {
    return "Hello, world!";
  }
}

/** @gqlType */
type Query = unknown;
```

## Output

### SDL

```graphql
type Query {
  greet: String
}
```

### TypeScript

```ts
import queryGreetResolver from "./FieldAsStaticClassMethodOnUnnamedNonGqlClass";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greet: {
                    name: "greet",
                    type: GraphQLString,
                    resolve(source) {
                        return queryGreetResolver.greet(source);
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