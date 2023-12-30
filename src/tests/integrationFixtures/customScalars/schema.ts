import { DateTime as DateTimeType } from "./index";
import { echo as queryEchoResolver } from "./index";
import { now as queryNowResolver } from "./index";
import { GraphQLScalarValueParser, GraphQLScalarLiteralParser, GraphQLSchema, GraphQLObjectType, GraphQLScalarType, GraphQLScalarSerializer, GraphQLNonNull } from "graphql";
type ScalarConfigType<T> = {
    serialize(outputValue: T): any;
    parseValue: GraphQLScalarValueParser<T>;
    parseLiteral: GraphQLScalarLiteralParser<T>;
};
export type SchemaConfigType = {
    scalars: {
        DateTime: ScalarConfigType<DateTimeType>;
    };
};
export function getSchema(config: SchemaConfigType): GraphQLSchema {
    const DateTimeType: GraphQLScalarType = new GraphQLScalarType<DateTimeType>({
        name: "DateTime",
        serialize: config.scalars.DateTime.serialize as GraphQLScalarSerializer<DateTimeType>,
        parseValue: config.scalars.DateTime.parseValue,
        parseLiteral: config.scalars.DateTime.parseLiteral
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                echo: {
                    name: "echo",
                    type: DateTimeType,
                    args: {
                        in: {
                            name: "in",
                            type: new GraphQLNonNull(DateTimeType)
                        }
                    },
                    resolve(source, args) {
                        return queryEchoResolver(source, args);
                    }
                },
                now: {
                    name: "now",
                    type: DateTimeType,
                    resolve(source) {
                        return queryNowResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType, DateTimeType]
    });
}
