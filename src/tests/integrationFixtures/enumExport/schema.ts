import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLEnumType } from "graphql";
import { colorName as queryColorNameResolver, currentPriority as queryCurrentPriorityResolver, favoriteColor as queryFavoriteColorResolver } from "./index";
export function getSchema(): GraphQLSchema {
    const ColorType: GraphQLEnumType = new GraphQLEnumType({
        name: "Color",
        values: {
            blue: {
                value: "blue"
            },
            green: {
                value: "green"
            },
            red: {
                value: "red"
            }
        }
    });
    const PriorityType: GraphQLEnumType = new GraphQLEnumType({
        name: "Priority",
        values: {
            high: {
                value: "high"
            },
            low: {
                value: "low"
            },
            medium: {
                value: "medium"
            }
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                colorName: {
                    name: "colorName",
                    type: GraphQLString,
                    args: {
                        color: {
                            type: new GraphQLNonNull(ColorType)
                        }
                    },
                    resolve(_source, args) {
                        return queryColorNameResolver(args.color);
                    }
                },
                currentPriority: {
                    name: "currentPriority",
                    type: PriorityType,
                    resolve() {
                        return queryCurrentPriorityResolver();
                    }
                },
                favoriteColor: {
                    name: "favoriteColor",
                    type: ColorType,
                    resolve() {
                        return queryFavoriteColorResolver();
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [ColorType, PriorityType, QueryType]
    });
}
