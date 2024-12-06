-----------------
INPUT
----------------- 
/** @gqlInterface Person */
interface DONT_USE_THIS {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class User implements DONT_USE_THIS {
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}

-----------------
OUTPUT
-----------------
-- SDL --
interface Person {
  name: String
}

type User implements Person {
  name: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const PersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Person",
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
                    type: GraphQLString
                }
            };
        },
        interfaces() {
            return [PersonType];
        }
    });
    return new GraphQLSchema({
        types: [PersonType, UserType]
    });
}
