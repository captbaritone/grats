-----------------
INPUT
----------------- 
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export const greeting = async (_: SomeType): Promise<string> => {
  return `Hello World`;
};

-----------------
OUTPUT
-----------------
-- SDL --
type SomeType {
  greeting: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as someTypeGreetingResolver } from "./fieldAsExportedAsyncArrowFunction";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve(source) {
                        return someTypeGreetingResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
