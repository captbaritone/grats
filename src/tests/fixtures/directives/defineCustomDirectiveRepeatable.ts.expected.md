# directives/defineCustomDirectiveRepeatable.ts

## Input

```ts title="directives/defineCustomDirectiveRepeatable.ts"
/**
 * This is my custom directive.
 * @gqlDirective repeatable on FIELD_DEFINITION
 */
function customDirective() {}
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @customDirective repeatable on FIELD_DEFINITION
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, specifiedDirectives } from "graphql";
export function getSchema(): GraphQLSchema {
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "customDirective",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "This is my custom directive.",
                isRepeatable: true
            })],
        types: []
    });
}
```