# resolver_context/ContextValueBeforeArgs.ts

## Input

```ts title="resolver_context/ContextValueBeforeArgs.ts"
/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: SomeOtherType, args: { fallbackGreeting: string }): string {
    return ctx.greeting ?? args.fallbackGreeting;
  }
}

/** @gqlContext */
type SomeOtherType = { greeting?: string };
```

## Output

### SDL

```graphql
type SomeType {
  greeting(fallbackGreeting: String!): String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    args: {
                        fallbackGreeting: {
                            type: new GraphQLNonNull(GraphQLString)
                        }
                    },
                    resolve(source, args, context) {
                        return source.greeting(context, args);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```