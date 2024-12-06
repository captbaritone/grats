-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me(): User {
    return new User();
  }
}

/** @gqlInterface */
interface IPerson {
  /**
   * The person's name
   * @gqlField
   */
  name: string;
}

/** @gqlType */
class User implements IPerson {
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}

-----------------
OUTPUT
-----------------
-- SDL --
interface IPerson {
  """The person's name"""
  name: String
}

type SomeType {
  me: User
}

type User implements IPerson {
  name: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const IPersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "IPerson",
        fields() {
            return {
                name: {
                    description: "The person's name",
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
            return [IPersonType];
        }
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                me: {
                    name: "me",
                    type: UserType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [IPersonType, SomeTypeType, UserType]
    });
}
