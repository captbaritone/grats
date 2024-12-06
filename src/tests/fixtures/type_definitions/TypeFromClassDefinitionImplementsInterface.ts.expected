-----------------
INPUT
----------------- 
/** @gqlInterface */
interface Person {
  /** @gqlField */
  hello: string;
}

/** @gqlType */
export default class User implements Person {
  readonly __typename = "User" as const;
  /** @gqlField */
  hello: string;
}

-----------------
OUTPUT
-----------------
-- SDL --
interface Person {
  hello: String
}

type User implements Person {
  hello: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const PersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Person",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString
                }
            };
        }
    });
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                hello: {
                    name: "hello",
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
