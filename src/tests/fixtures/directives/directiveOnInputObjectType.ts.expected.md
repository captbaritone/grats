-----------------
INPUT
----------------- 
import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on INPUT_OBJECT
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlInput
 * @gqlAnnotate max(foo: 10)
 */
type MyType = {
  myField: string;
};

-----------------
OUTPUT
-----------------
-- SDL --
"""This is my custom directive."""
directive @max(foo: Int!) on INPUT_OBJECT

input MyType @max(foo: 10) {
  myField: String!
}
-- TypeScript --
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLInt, specifiedDirectives, GraphQLInputObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const MyTypeType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "MyType",
        fields() {
            return {
                myField: {
                    name: "myField",
                    type: new GraphQLNonNull(GraphQLString)
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
                locations: [DirectiveLocation.INPUT_OBJECT],
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
