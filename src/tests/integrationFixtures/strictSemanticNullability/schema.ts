import { actuallyReturnsAsyncNull as queryActuallyReturnsAsyncNullResolver, actuallyReturnsNull as queryActuallyReturnsNullResolver, me as queryMeResolver, names as subscriptionNamesResolver } from "./index";
import { defaultFieldResolver, GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLList, GraphQLInt, GraphQLObjectType, GraphQLString, GraphQLInterfaceType } from "graphql";
async function assertNonNull<T>(value: T | Promise<T>): Promise<T> {
    const awaited = await value;
    if (awaited == null)
        throw new Error("Cannot return null for semantically non-nullable field.");
    return awaited;
}
export function getSchema(): GraphQLSchema {
    const IPersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "IPerson",
        fields() {
            return {
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                name: {
                    name: "name",
                    type: GraphQLString,
                    resolve(source, args, context, info) {
                        return assertNonNull(defaultFieldResolver(source, args, context, info));
                    }
                },
                notName: {
                    name: "notName",
                    type: GraphQLString,
                    resolve(source) {
                        return assertNonNull(source.alsoName);
                    }
                }
            };
        },
        interfaces() {
            return [IPersonType];
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                actuallyReturnsAsyncNull: {
                    name: "actuallyReturnsAsyncNull",
                    type: GraphQLString,
                    resolve() {
                        return assertNonNull(queryActuallyReturnsAsyncNullResolver());
                    }
                },
                actuallyReturnsNull: {
                    name: "actuallyReturnsNull",
                    type: GraphQLString,
                    resolve() {
                        return assertNonNull(queryActuallyReturnsNullResolver());
                    }
                },
                me: {
                    name: "me",
                    type: UserType,
                    resolve() {
                        return assertNonNull(queryMeResolver());
                    }
                }
            };
        }
    });
    const SubscriptionType: GraphQLObjectType = new GraphQLObjectType({
        name: "Subscription",
        fields() {
            return {
                names: {
                    name: "names",
                    type: GraphQLString,
                    subscribe() {
                        return subscriptionNamesResolver();
                    },
                    resolve(payload) {
                        return assertNonNull(payload);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        directives: [new GraphQLDirective({
                name: "semanticNonNull",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "Indicates that a position is semantically non null: it is only null if there is a matching error in the `errors` array.\nIn all other cases, the position is non-null.\n\nTools doing code generation may use this information to generate the position as non-null if field errors are handled out of band:\n\n```graphql\ntype User {\n    # email is semantically non-null and can be generated as non-null by error-handling clients.\n    email: String @semanticNonNull\n}\n```\n\nThe `levels` argument indicates what levels are semantically non null in case of lists:\n\n```graphql\ntype User {\n    # friends is semantically non null\n    friends: [User] @semanticNonNull # same as @semanticNonNull(levels: [0])\n\n    # every friends[k] is semantically non null\n    friends: [User] @semanticNonNull(levels: [1])\n\n    # friends as well as every friends[k] is semantically non null\n    friends: [User] @semanticNonNull(levels: [0, 1])\n}\n```\n\n`levels` are zero indexed.\nPassing a negative level or a level greater than the list dimension is an error.",
                args: {
                    levels: {
                        type: new GraphQLList(GraphQLInt),
                        defaultValue: [0]
                    }
                }
            })],
        query: QueryType,
        subscription: SubscriptionType,
        types: [IPersonType, QueryType, SubscriptionType, UserType]
    });
}
