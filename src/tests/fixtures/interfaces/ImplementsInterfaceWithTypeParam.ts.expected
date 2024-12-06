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
interface Person<T> {
  /** @gqlField */
  name: string;

  other: T;
}

/** @gqlType */
class User implements Person<string> {
  __typename = "User" as const;
  /** @gqlField */
  name: string;

  other: string;
}

-----------------
OUTPUT
-----------------
-- SDL --
interface Person {
  name: String
}

type SomeType {
  me: User
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
        types: [PersonType, SomeTypeType, UserType]
    });
}
