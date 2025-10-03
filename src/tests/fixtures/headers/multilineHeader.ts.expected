-----------------
INPUT
----------------- 
// {"schemaHeader": ["# Generated SDL\n", "# multi-line"], "tsSchemaHeader": ["// Generated TS\n", "// multi-line"]}
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}

-----------------
OUTPUT
-----------------
-- SDL --
# Generated SDL

# multi-line

type SomeType {
  hello: String
}
-- TypeScript --
// Generated TS

// multi-line

import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
