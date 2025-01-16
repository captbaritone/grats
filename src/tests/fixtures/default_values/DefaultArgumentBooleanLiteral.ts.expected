-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({ greet = false }: { greet?: boolean | null }): string {
    if (!greet) return "";
    return "hello";
  }

  /** @gqlField */
  someField2({ greet = true }: { greet?: boolean | null }): string {
    if (!greet) return "";
    return "hello";
  }
}

-----------------
OUTPUT
-----------------
-- SDL --
type SomeType {
  someField1(greet: Boolean = false): String
  someField2(greet: Boolean = true): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLBoolean } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                someField1: {
                    name: "someField1",
                    type: GraphQLString,
                    args: {
                        greet: {
                            type: GraphQLBoolean,
                            defaultValue: false
                        }
                    }
                },
                someField2: {
                    name: "someField2",
                    type: GraphQLString,
                    args: {
                        greet: {
                            type: GraphQLBoolean,
                            defaultValue: true
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
