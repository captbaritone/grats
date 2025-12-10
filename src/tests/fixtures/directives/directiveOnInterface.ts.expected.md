-----------------
INPUT
----------------- 
import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on INTERFACE
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlInterface
 * @gqlAnnotate max(foo: 10)
 */
interface MyInterface {
  /** @gqlField */
  myField: string;
}

-----------------
OUTPUT
-----------------
-- SDL --
"""This is my custom directive."""
directive @max(foo: Int!) on INTERFACE

interface MyInterface @max(foo: 10) {
  myField: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLInt, specifiedDirectives, GraphQLInterfaceType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const MyInterfaceType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "MyInterface",
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
                locations: [DirectiveLocation.INTERFACE],
                description: "This is my custom directive.",
                args: {
                    foo: {
                        type: new GraphQLNonNull(GraphQLInt)
                    }
                }
            })],
        types: [MyInterfaceType]
    });
}
