-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  constructor(
    /** @gqlField hello */
    public foo: string,
  ) {}
}

-----------------
OUTPUT
-----------------
-- SDL --
type SomeType {
  hello: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    resolve(source) {
                        return source.foo;
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
