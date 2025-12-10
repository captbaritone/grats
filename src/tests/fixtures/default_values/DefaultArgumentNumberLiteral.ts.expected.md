-----------------
INPUT
----------------- 
import { Float, Int } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  intField({ count = 10 }: { count: Int }): string {
    return `${count} world!`;
  }
  /** @gqlField */
  floatField({ scale = 10.0 }: { scale: Float }): string {
    return `${scale} world!`;
  }
}

-----------------
OUTPUT
-----------------
-- SDL --
type SomeType {
  floatField(scale: Float! = 10): String
  intField(count: Int! = 10): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLFloat, GraphQLInt } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                floatField: {
                    name: "floatField",
                    type: GraphQLString,
                    args: {
                        scale: {
                            type: new GraphQLNonNull(GraphQLFloat),
                            defaultValue: 10
                        }
                    }
                },
                intField: {
                    name: "intField",
                    type: GraphQLString,
                    args: {
                        count: {
                            type: new GraphQLNonNull(GraphQLInt),
                            defaultValue: 10
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
