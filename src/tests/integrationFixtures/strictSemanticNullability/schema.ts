import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLList, GraphQLInt, specifiedDirectives, GraphQLObjectType, GraphQLString, defaultFieldResolver, GraphQLInterfaceType } from "graphql";
import { actuallyReturnsAsyncNull as queryActuallyReturnsAsyncNullResolver, actuallyReturnsNull as queryActuallyReturnsNullResolver, me as queryMeResolver, names as subscriptionNamesResolver } from "./index.js";
async function assertNonNull<T>(value: T | Promise<T>): Promise<T> {
    const awaited = await value;
    if (awaited == null) throw new Error("Cannot return null for semantically non-nullable field.");
    return awaited;
}
export function getSchema(): GraphQLSchema {
    const IPersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "IPerson",
        fields() {
            return { name: {
                name: "name",
                type: GraphQLString
            } };
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
            return { names: {
                name: "names",
                type: GraphQLString,
                subscribe() {
                    return subscriptionNamesResolver();
                },
                resolve(payload) {
                    return assertNonNull(payload);
                }
            } };
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
            name: "semanticNonNull",
            locations: [DirectiveLocation.FIELD_DEFINITION],
            description: "Indicates that a field's result is semantically non null at the indicated levels:\nit is only null if there is a matching error in the `errors` array of the response.\nIn all other cases, the position contains a value.\n\nTools doing code generation may use this information to generate the position as non-null if field errors are handled out of band:\n\n```graphql\ntype User {\n    # email is semantically non-null and can be generated as non-null by error-handling clients.\n    email: String @semanticNonNull\n}\n```\n\nThe `levels` argument selects which levels of a (possibly nested) list type are semantically non null:\n\n```graphql\ntype User {\n    # friends is semantically non null\n    friends: [User] @semanticNonNull # same as @semanticNonNull(levels: [0])\n\n    # every friends[k] is semantically non null\n    friends: [User] @semanticNonNull(levels: [1])\n\n    # friends as well as every friends[k] is semantically non null\n    friends: [User] @semanticNonNull(levels: [0, 1])\n}\n```\n\n`levels` are zero indexed, where level 0 is the field's own value.\nA level that is negative, or that exceeds the list dimensionality of the annotated field, is an error.\nApplying `@semanticNonNull` to a level that is already Non-Null is an error.",
            args: { levels: {
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLInt))),
                defaultValue: [0]
            } }
        })],
        query: QueryType,
        subscription: SubscriptionType,
        types: [
            IPersonType,
            QueryType,
            SubscriptionType,
            UserType
        ]
    });
}
