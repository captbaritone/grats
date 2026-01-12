# directives/directiveOnObjectType.ts

## Input

```ts title="directives/directiveOnObjectType.ts"
import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on OBJECT
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlType
 * @gqlAnnotate max(foo: 10)
 */
type MyType = {
  /** @gqlField */
  myField: string;
};
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @max(foo: Int!) on OBJECT

type MyType @max(foo: 10) {
  myField: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLInt, specifiedDirectives, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const MyTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "MyType",
        fields() {
            return {
                myField: {
                    name: "myField",
                    type: GraphQLString
                }
            };
        },
        extensions: {
            grats: {
                directives: [{
                        name: "max",
                        args: {
                            foo: 10
                        }
                    }]
            }
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "max",
                locations: [DirectiveLocation.OBJECT],
                description: "This is my custom directive.",
                args: {
                    foo: {
                        type: new GraphQLNonNull(GraphQLInt)
                    }
                }
            })],
        types: [MyTypeType]
    });
}
```