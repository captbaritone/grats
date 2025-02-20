-----------------
INPUT
----------------- 
/**
 * @gqlInput
 */
export type Greeting = { firstName: string } | { lastName: string };

-----------------
OUTPUT
-----------------
-- SDL --
input Greeting @oneOf {
  firstName: String
  lastName: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLInputObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const GreetingType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "Greeting",
        fields() {
            return {
                firstName: {
                    name: "firstName",
                    type: GraphQLString
                },
                lastName: {
                    name: "lastName",
                    type: GraphQLString
                }
            };
        },
        isOneOf: true
    });
    return new GraphQLSchema({
        types: [GreetingType]
    });
}
