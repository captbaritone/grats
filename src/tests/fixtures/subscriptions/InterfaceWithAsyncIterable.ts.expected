-----------------
INPUT
----------------- 
/** @gqlInterface */
export interface NotSubscription {
  /** @gqlField */
  greetings(): AsyncIterable<string>;
}

-----------------
OUTPUT
-----------------
-- SDL --
interface NotSubscription {
  greetings: [String!]
}
-- TypeScript --
import { GraphQLSchema, GraphQLInterfaceType, GraphQLList, GraphQLNonNull, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const NotSubscriptionType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "NotSubscription",
        fields() {
            return {
                greetings: {
                    name: "greetings",
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString))
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [NotSubscriptionType]
    });
}
