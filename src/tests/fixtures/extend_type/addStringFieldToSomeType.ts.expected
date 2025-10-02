-----------------
INPUT
----------------- 
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export function greeting(_: SomeType): string {
  return "Hello world!";
}

-----------------
OUTPUT
-----------------
-- SDL --
type SomeType {
  greeting: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as someTypeGreetingResolver } from "./addStringFieldToSomeType";
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
