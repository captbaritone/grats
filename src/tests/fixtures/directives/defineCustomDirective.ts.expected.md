-----------------
INPUT
----------------- 
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective() {}

-----------------
OUTPUT
-----------------
-- SDL --
"""This is my custom directive."""
directive @customDirective on FIELD_DEFINITION
-- TypeScript --
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, specifiedDirectives } from "graphql";
export function getSchema(): GraphQLSchema {
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "customDirective",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "This is my custom directive."
            })],
        types: []
    });
}
