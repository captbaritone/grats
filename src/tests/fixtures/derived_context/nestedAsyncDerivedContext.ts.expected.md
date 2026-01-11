# derived_context/nestedAsyncDerivedContext.ts

## Input

```ts title="derived_context/nestedAsyncDerivedContext.ts"
/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext1 = {
  greeting: string;
};
type DerivedContext2 = {
  greeting: string;
};

/** @gqlContext */
export async function createDerivedContext1(
  ctx: RootContext,
): Promise<DerivedContext1> {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlContext */
export async function createDerivedContext2(
  ctx: DerivedContext1,
): Promise<DerivedContext2> {
  return { greeting: `Hello, ${ctx.greeting}!` };
}

/** @gqlQueryField */
export function greeting(ctx: DerivedContext2): string {
  return ctx.greeting;
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
import { greeting as queryGreetingResolver, createDerivedContext2, createDerivedContext1 } from "./nestedAsyncDerivedContext";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    async resolve(_source, _args, context) {
                        return queryGreetingResolver(await createDerivedContext2(await createDerivedContext1(context)));
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