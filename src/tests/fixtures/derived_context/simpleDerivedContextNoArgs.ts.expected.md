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
export function createDerivedContext(): DerivedContext {
  return { greeting: `Hello!` };
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
import { greeting as queryGreetingResolver, createDerivedContext } from "./simpleDerivedContextNoArgs";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve(source) {
                        return queryGreetingResolver(source, createDerivedContext());
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
