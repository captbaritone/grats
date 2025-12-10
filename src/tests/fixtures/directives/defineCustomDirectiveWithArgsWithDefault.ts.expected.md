## input

```ts title="directives/defineCustomDirectiveWithArgsWithDefault.ts"
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective({ someArg = "Hello" }: { someArg: string }) {}
```

## Output

```
-- SDL --
"""This is my custom directive."""
directive @customDirective(someArg: String! = "Hello") on FIELD_DEFINITION
-- TypeScript --
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLString, specifiedDirectives } from "graphql";
export function getSchema(): GraphQLSchema {
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "customDirective",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "This is my custom directive.",
                args: {
                    someArg: {
                        type: new GraphQLNonNull(GraphQLString),
                        defaultValue: "Hello"
                    }
                }
            })],
        types: []
    });
}
```