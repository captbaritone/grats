-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({
    inputs = ["hello", "there"],
  }: {
    inputs?: string[] | null;
  }): string {
    if (inputs === null) {
      return "got null";
    }
    return inputs.join("|");
  }
}

-----------------
OUTPUT
-----------------
-- SDL --
type SomeType {
  someField1(inputs: [String!] = ["hello", "there"]): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLList, GraphQLNonNull } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                someField1: {
                    name: "someField1",
                    type: GraphQLString,
                    args: {
                        inputs: {
                            type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
                            defaultValue: [
                                "hello",
                                "there"
                            ]
                        }
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
