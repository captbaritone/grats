import { actuallyReturnsAsyncNull as queryActuallyReturnsAsyncNullResolver } from "./index";
import { actuallyReturnsNull as queryActuallyReturnsNullResolver } from "./index";
import { me as queryMeResolver } from "./index";
import { names as subscriptionNamesResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString, defaultFieldResolver, GraphQLInterfaceType } from "graphql";
async function assertNonNull<T>(value: T | Promise<T>): Promise<T> {
    const awaited = await value;
    if (awaited == null)
        throw new Error("Cannot return null for semantically non-nullable field.");
    return awaited;
}
async function assertNonNull<T>(value: T | Promise<T>): Promise<T> {
    const awaited = await value;
    if (awaited == null)
        throw new Error("Cannot return null for semantically non-nullable field.");
    return awaited;
}
async function assertNonNull<T>(value: T | Promise<T>): Promise<T> {
    const awaited = await value;
    if (awaited == null)
        throw new Error("Cannot return null for semantically non-nullable field.");
    return awaited;
}
async function assertNonNull<T>(value: T | Promise<T>): Promise<T> {
    const awaited = await value;
    if (awaited == null)
        throw new Error("Cannot return null for semantically non-nullable field.");
    return awaited;
}
async function assertNonNull<T>(value: T | Promise<T>): Promise<T> {
    const awaited = await value;
    if (awaited == null)
        throw new Error("Cannot return null for semantically non-nullable field.");
    return awaited;
}
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
                    resolve(source) {
                        return assertNonNull(queryActuallyReturnsAsyncNullResolver(source));
                    }
                },
                actuallyReturnsNull: {
                    name: "actuallyReturnsNull",
                    type: GraphQLString,
                    resolve(source) {
                        return assertNonNull(queryActuallyReturnsNullResolver(source));
                    }
                },
                me: {
                    name: "me",
                    type: UserType,
                    resolve(source) {
                        return assertNonNull(queryMeResolver(source));
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
                    subscribe(source) {
                        return subscriptionNamesResolver(source);
                    },
                    resolve(payload) {
                        return assertNonNull(payload);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        subscription: SubscriptionType,
        types: [IPersonType, QueryType, SubscriptionType, UserType]
    });
}
