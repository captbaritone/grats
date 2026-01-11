# derived_context/derivedContextPromiseValid.ts

## Input

```ts title="derived_context/derivedContextPromiseValid.ts"
/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export async function createDerivedContext(
  ctx: RootContext,
): Promise<DerivedContext> {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlQueryField */
export function greeting(ctx: DerivedContext): string {
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
import { greeting as queryGreetingResolver, createDerivedContext } from "./derivedContextPromiseValid";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    async resolve(_source, _args, context) {
                        return queryGreetingResolver(await createDerivedContext(context));
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