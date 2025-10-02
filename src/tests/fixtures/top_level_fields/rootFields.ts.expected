-----------------
INPUT
----------------- 
import { Int } from "../../../Types";
/** @gqlQueryField */
export function greeting(): string {
  return "Hello world";
}

/** @gqlMutationField */
export function deleteSomething(): string {
  return "Hello world";
}

/** @gqlSubscriptionField */
export async function* range(from: Int): AsyncIterable<Int> {
  for (let i = from; i >= 0; i--) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    yield i;
  }
}

-----------------
OUTPUT
-----------------
-- SDL --
type Mutation {
  deleteSomething: String
}

type Query {
  greeting: String
}

type Subscription {
  range(from: Int!): Int
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLNonNull } from "graphql";
import { greeting as queryGreetingResolver, deleteSomething as mutationDeleteSomethingResolver, range as subscriptionRangeResolver } from "./rootFields";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve() {
                        return queryGreetingResolver();
                    }
                }
            };
        }
    });
    const MutationType: GraphQLObjectType = new GraphQLObjectType({
        name: "Mutation",
        fields() {
            return {
                deleteSomething: {
                    name: "deleteSomething",
                    type: GraphQLString,
                    resolve() {
                        return mutationDeleteSomethingResolver();
                    }
                }
            };
        }
    });
    const SubscriptionType: GraphQLObjectType = new GraphQLObjectType({
        name: "Subscription",
        fields() {
            return {
                range: {
                    name: "range",
                    type: GraphQLInt,
                    args: {
                        from: {
                            type: new GraphQLNonNull(GraphQLInt)
                        }
                    },
                    subscribe(_source, args) {
                        return subscriptionRangeResolver(args.from);
                    },
                    resolve(payload) {
                        return payload;
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        mutation: MutationType,
        subscription: SubscriptionType,
        types: [MutationType, QueryType, SubscriptionType]
    });
}
