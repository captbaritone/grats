## input

```ts title="resolver_context/FunctionWithContextValue.ts"
/** @gqlContext */
type GratsContext = {
  greeting: string;
};

/** @gqlType */
export class User {}

/** @gqlField */
export function greeting(_: User, ctx: GratsContext): string {
  return ctx.greeting;
}
```

## Output

```
-- SDL --
type User {
  greeting: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as userGreetingResolver } from "./FunctionWithContextValue";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve(source, _args, context) {
                        return userGreetingResolver(source, context);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [UserType]
    });
}
```