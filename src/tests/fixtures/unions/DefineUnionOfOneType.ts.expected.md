-----------------
INPUT
----------------- 
/** @gqlType */
class User {
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}

/** @gqlUnion */
type Actor = User;

-----------------
OUTPUT
-----------------
-- SDL --
union Actor = User

type User {
  name: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLUnionType, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    const ActorType: GraphQLUnionType = new GraphQLUnionType({
        name: "Actor",
        types() {
            return [UserType];
        }
    });
    return new GraphQLSchema({
        types: [ActorType, UserType]
    });
}
