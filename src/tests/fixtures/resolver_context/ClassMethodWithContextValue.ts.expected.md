## input

```ts title="resolver_context/ClassMethodWithContextValue.ts"
/** @gqlContext */
type GratsContext = {
  greeting: string;
};

/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: GratsContext): string {
    return ctx.greeting;
  }
}
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
                        return source.greeting(context);
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