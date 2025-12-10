-----------------
INPUT
----------------- 
import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on SCALAR
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlScalar
 * @gqlAnnotate max(foo: 10)
 */
export type MyScalar = string;

-----------------
OUTPUT
-----------------
-- SDL --
"""This is my custom directive."""
directive @max(foo: Int!) on SCALAR

scalar MyScalar @max(foo: 10)
-- TypeScript --
import type { GqlScalar } from "grats";
import type { MyScalar as MyScalarInternal } from "./directiveOnScalar";
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLInt, specifiedDirectives, GraphQLScalarType } from "graphql";
export type SchemaConfig = {
    scalars: {
        MyScalar: GqlScalar<MyScalarInternal>;
    };
};
export function getSchema(config: SchemaConfig): GraphQLSchema {
    const MyScalarType: GraphQLScalarType = new GraphQLScalarType({
        name: "MyScalar",
        extensions: {
            grats: {
                directives: [{
                        name: "max",
                        args: {
                            foo: 10
                        }
                    }]
            }
        },
        ...config.scalars.MyScalar
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "max",
                locations: [DirectiveLocation.SCALAR],
                description: "This is my custom directive.",
                args: {
                    foo: {
                        type: new GraphQLNonNull(GraphQLInt)
                    }
                }
            })],
        types: [MyScalarType]
    });
}
