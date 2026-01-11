# directives/defineCustomDirectiveMultipleLocations.ts

## Input

```ts title="directives/defineCustomDirectiveMultipleLocations.ts"
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION | ARGUMENT_DEFINITION
 */
function customDirective() {}
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @customDirective on FIELD_DEFINITION | ARGUMENT_DEFINITION
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, specifiedDirectives } from "graphql";
export function getSchema(): GraphQLSchema {
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "customDirective",
                locations: [DirectiveLocation.FIELD_DEFINITION, DirectiveLocation.ARGUMENT_DEFINITION],
                description: "This is my custom directive."
            })],
        types: []
    });
}
```