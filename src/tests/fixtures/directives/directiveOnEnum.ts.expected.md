# directives/directiveOnEnum.ts

## Input

```ts title="directives/directiveOnEnum.ts"
import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on ENUM
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlEnum
 * @gqlAnnotate max(foo: 10)
 */
type MyEnum = "A" | "B";
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @max(foo: Int!) on ENUM

enum MyEnum @max(foo: 10) {
  A
  B
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLInt, specifiedDirectives, GraphQLEnumType } from "graphql";
export function getSchema(): GraphQLSchema {
    const MyEnumType: GraphQLEnumType = new GraphQLEnumType({
        name: "MyEnum",
        values: {
            A: {
                value: "A"
            },
            B: {
                value: "B"
            }
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
                locations: [DirectiveLocation.ENUM],
                description: "This is my custom directive.",
                args: {
                    foo: {
                        type: new GraphQLNonNull(GraphQLInt)
                    }
                }
            })],
        types: [MyEnumType]
    });
}
```