# directives/multilineAnnotatedDirectiveWithBlockString.ts

## Input

```ts title="directives/multilineAnnotatedDirectiveWithBlockString.ts"
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(args: { foo: string; bar: string }) {}

/**
 * @gqlQueryField
 * @gqlAnnotate customDirective(
 *   foo: """
 *     First line
 *       Indented line
 *   """,
 *   bar: "bar"
 * )
 */
export function myQueryField(): string {
  return "myQueryField";
}
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @customDirective(foo: String!, bar: String!) on FIELD_DEFINITION

type Query {
  myQueryField: String @customDirective(bar: "bar", foo: """
  First line
    Indented line
  """)
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLString, specifiedDirectives, GraphQLObjectType } from "graphql";
import { myQueryField as queryMyQueryFieldResolver } from "./multilineAnnotatedDirectiveWithBlockString";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return { myQueryField: {
                name: "myQueryField",
                type: GraphQLString,
                extensions: { grats: { directives: [{
                    name: "customDirective",
                    args: {
                        bar: "bar",
                        foo: "First line\n  Indented line"
                    }
                }] } },
                resolve() {
                    return queryMyQueryFieldResolver();
                }
            } };
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
            name: "customDirective",
            locations: [DirectiveLocation.FIELD_DEFINITION],
            description: "This is my custom directive.",
            args: {
                foo: { type: new GraphQLNonNull(GraphQLString) },
                bar: { type: new GraphQLNonNull(GraphQLString) }
            }
        })],
        query: QueryType,
        types: [QueryType]
    });
}
```