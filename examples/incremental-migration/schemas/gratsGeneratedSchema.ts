// DO NOT USE DIRECTLY. Prefer the merged schema in `./mergedSchema.ts`.
import { user as queryUserResolver } from "./../models";
import { GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLString, GraphQLID } from "graphql";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                firstName: {
                    name: "firstName",
                    type: new GraphQLNonNull(GraphQLString)
                },
                fullName: {
                    name: "fullName",
                    type: new GraphQLNonNull(GraphQLString)
                },
                id: {
                    name: "id",
                    type: new GraphQLNonNull(GraphQLID)
                },
                lastName: {
                    name: "lastName",
                    type: new GraphQLNonNull(GraphQLString)
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                user: {
                    name: "user",
                    type: UserType,
                    args: {
                        id: {
                            name: "id",
                            type: new GraphQLNonNull(GraphQLID)
                        }
                    },
                    resolve(source, args) {
                        return queryUserResolver(source, args.id);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType, UserType]
    });
}
