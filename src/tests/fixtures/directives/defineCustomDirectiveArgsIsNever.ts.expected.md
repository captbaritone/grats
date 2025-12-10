## input

```ts title="directives/defineCustomDirectiveArgsIsNever.ts"
import { GraphQLFieldResolver } from "graphql";

/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(
  _: never,
  _someArg: GraphQLFieldResolver<unknown, unknown>,
) {
  //
}
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @customDirective on FIELD_DEFINITION
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, specifiedDirectives } from "graphql";
export function getSchema(): GraphQLSchema {
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "customDirective",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "This is my custom directive."
            })],
        types: []
    });
}
```