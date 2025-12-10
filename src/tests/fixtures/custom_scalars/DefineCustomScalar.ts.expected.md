-----------------
INPUT
----------------- 
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlScalar */
export type MyUrl = string;

-----------------
OUTPUT
-----------------
-- SDL --
scalar MyUrl

type SomeType {
  hello: String
}
-- TypeScript --
import type { GqlScalar } from "grats";
import type { MyUrl as MyUrlInternal } from "./DefineCustomScalar";
import { GraphQLSchema, GraphQLScalarType, GraphQLObjectType, GraphQLString } from "graphql";
export type SchemaConfig = {
    scalars: {
        MyUrl: GqlScalar<MyUrlInternal>;
    };
};
export function getSchema(config: SchemaConfig): GraphQLSchema {
    const MyUrlType: GraphQLScalarType = new GraphQLScalarType({
        name: "MyUrl",
        ...config.scalars.MyUrl
    });
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
        types: [MyUrlType, SomeTypeType]
    });
}
