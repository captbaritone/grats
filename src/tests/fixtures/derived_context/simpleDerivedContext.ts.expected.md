-----------------
INPUT
----------------- 
/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export function createDerivedContext(ctx: RootContext): DerivedContext {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query, ctx: DerivedContext): string {
  return ctx.greeting;
}

-----------------
OUTPUT
-----------------
-- SDL --
type Query {
  greeting: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as queryGreetingResolver, createDerivedContext } from "./simpleDerivedContext";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve(source, _args, context) {
                        return queryGreetingResolver(source, createDerivedContext(context));
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType]
    });
}
