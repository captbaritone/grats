-----------------
INPUT
----------------- 
/** @gqlInput */
interface MyInputType {
  someField?: string;
}

-----------------
OUTPUT
-----------------
-- SDL --
input MyInputType {
  someField: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLInputObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const MyInputTypeType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "MyInputType",
        fields() {
            return {
                someField: {
                    name: "someField",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [MyInputTypeType]
    });
}
