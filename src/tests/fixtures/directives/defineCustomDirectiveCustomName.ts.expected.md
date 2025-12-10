## input

```ts title="directives/defineCustomDirectiveCustomName.ts"
/**
 * This is my custom directive.
 * @gqlDirective aBetterName on FIELD_DEFINITION
 */
export function customDirective() {}
```

## Output

```
-- SDL --
"""This is my custom directive."""
directive @aBetterName on FIELD_DEFINITION
-- TypeScript --
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, specifiedDirectives } from "graphql";
export function getSchema(): GraphQLSchema {
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "aBetterName",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "This is my custom directive."
            })],
        types: []
    });
}
```