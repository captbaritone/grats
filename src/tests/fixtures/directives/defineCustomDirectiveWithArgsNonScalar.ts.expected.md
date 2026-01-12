# directives/defineCustomDirectiveWithArgsNonScalar.ts

## Input

```ts title="directives/defineCustomDirectiveWithArgsNonScalar.ts"
/** @gqlInput */
type SomeInput = {
  someField: string;
};

/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(args: { someArg: SomeInput }) {}
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @customDirective(someArg: SomeInput!) on FIELD_DEFINITION

input SomeInput {
  someField: String!
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLInputObjectType, GraphQLString, specifiedDirectives } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeInputType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "SomeInput",
        fields() {
            return {
                someField: {
                    name: "someField",
                    type: new GraphQLNonNull(GraphQLString)
                }
            };
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "customDirective",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "This is my custom directive.",
                args: {
                    someArg: {
                        type: new GraphQLNonNull(SomeInputType)
                    }
                }
            })],
        types: [SomeInputType]
    });
}
```