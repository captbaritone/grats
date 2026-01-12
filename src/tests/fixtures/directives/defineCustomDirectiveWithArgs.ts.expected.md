# directives/defineCustomDirectiveWithArgs.ts

## Input

```ts title="directives/defineCustomDirectiveWithArgs.ts"
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(arg: { someArg: string }) {}
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @customDirective(someArg: String!) on FIELD_DEFINITION
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLString, specifiedDirectives } from "graphql";
export function getSchema(): GraphQLSchema {
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "customDirective",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "This is my custom directive.",
                args: {
                    someArg: {
                        type: new GraphQLNonNull(GraphQLString)
                    }
                }
            })],
        types: []
    });
}
```