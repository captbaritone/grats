# directives/directiveOnUnion.ts

## Input

```ts title="directives/directiveOnUnion.ts"
import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on UNION
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlUnion
 * @gqlAnnotate max(foo: 10)
 */
type MyUnion = A | B;

/**
 * @gqlType
 */
type A = {
  __typename: "A";
  /** @gqlField */
  myField: string;
};

/**
 * @gqlType
 */
type B = {
  __typename: "B";
  /** @gqlField */
  myField: string;
};
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @max(foo: Int!) on UNION

union MyUnion @max(foo: 10) = A | B

type A {
  myField: String
}

type B {
  myField: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLInt, specifiedDirectives, GraphQLUnionType, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const AType: GraphQLObjectType = new GraphQLObjectType({
        name: "A",
        fields() {
            return {
                myField: {
                    name: "myField",
                    type: GraphQLString
                }
            };
        }
    });
    const BType: GraphQLObjectType = new GraphQLObjectType({
        name: "B",
        fields() {
            return {
                myField: {
                    name: "myField",
                    type: GraphQLString
                }
            };
        }
    });
    const MyUnionType: GraphQLUnionType = new GraphQLUnionType({
        name: "MyUnion",
        types() {
            return [AType, BType];
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
                locations: [DirectiveLocation.UNION],
                description: "This is my custom directive.",
                args: {
                    foo: {
                        type: new GraphQLNonNull(GraphQLInt)
                    }
                }
            })],
        types: [MyUnionType, AType, BType]
    });
}
```