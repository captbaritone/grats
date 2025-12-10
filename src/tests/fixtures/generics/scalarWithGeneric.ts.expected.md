-----------------
INPUT
----------------- 
// T is not inspected by Grats, so this is fine.
/** @gqlScalar */
export type MyScalar<T> = T;

-----------------
OUTPUT
-----------------
-- SDL --
scalar MyScalar
-- TypeScript --
import type { GqlScalar } from "grats";
import type { MyScalar as MyScalarInternal } from "./scalarWithGeneric";
import { GraphQLSchema, GraphQLScalarType } from "graphql";
export type SchemaConfig = {
    scalars: {
        MyScalar: GqlScalar<MyScalarInternal>;
    };
};
export function getSchema(config: SchemaConfig): GraphQLSchema {
    const MyScalarType: GraphQLScalarType = new GraphQLScalarType({
        name: "MyScalar",
        ...config.scalars.MyScalar
    });
    return new GraphQLSchema({
        types: [MyScalarType]
    });
}
