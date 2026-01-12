# directives/defineCustomDirectiveAdditionalArgsAreIgnored.ts

## Input

```ts title="directives/defineCustomDirectiveAdditionalArgsAreIgnored.ts"
import { GraphQLFieldResolver } from "graphql";

/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(
  args: { someArg: string },
  _someArg: GraphQLFieldResolver<unknown, unknown>,
) {
  //
}
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