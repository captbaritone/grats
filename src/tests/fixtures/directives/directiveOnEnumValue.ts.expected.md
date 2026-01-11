# directives/directiveOnEnumValue.ts

## Input

```ts title="directives/directiveOnEnumValue.ts"
import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on ENUM_VALUE
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlEnum
 */
enum MyEnum {
  /** @gqlAnnotate max(foo: 10) */
  a = "A",
  b = "B",
}
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @max(foo: Int!) on ENUM_VALUE

enum MyEnum {
  A @max(foo: 10)
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
                value: "A",
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
            },
            B: {
                value: "B"
            }
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "max",
                locations: [DirectiveLocation.ENUM_VALUE],
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