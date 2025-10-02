import type { GqlScalar } from "grats";
import { type CustomScalar as CustomScalarInternal, hello as queryHelloResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLScalarType, GraphQLNonNull } from "graphql";
export type SchemaConfig = {
    scalars: {
        CustomScalar: GqlScalar<CustomScalarInternal>;
    };
};
export function getSchema(config: SchemaConfig): GraphQLSchema {
    const CustomScalarType: GraphQLScalarType = new GraphQLScalarType({
        name: "CustomScalar",
        ...config.scalars.CustomScalar
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: CustomScalarType,
                    args: {
                        custom: {
                            type: new GraphQLNonNull(CustomScalarType)
                        }
                    },
                    resolve(_source, args) {
                        return queryHelloResolver(args.custom);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [CustomScalarType, QueryType]
    });
}
