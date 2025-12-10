## input

```ts title="resolver_context/ContextValueReadTwice.ts"
// No valid reason to do this, but just asserting that it works, since it happens to.

/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: SomeOtherType, alsoContext: SomeOtherType): string {
    return ctx.greeting ?? "Hello, world!";
  }
}

/** @gqlContext */
type SomeOtherType = { greeting?: string };
```

## Output

```
-- SDL --
type SomeType {
  greeting: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve(source, _args, context) {
                        return source.greeting(context, context);
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