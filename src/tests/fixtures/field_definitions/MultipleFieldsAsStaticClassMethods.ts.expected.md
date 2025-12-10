-----------------
INPUT
----------------- 
/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  static getUser(_: Query): User {
    return new User();
  }

  /** @gqlField */
  static getUsers(_: Query): User[] {
    return [new User()];
  }
}

/** @gqlType */
type Query = unknown;

-----------------
OUTPUT
-----------------
-- SDL --
type Query {
  getUser: User
  getUsers: [User!]
}

type User {
  name: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLList, GraphQLNonNull } from "graphql";
import { User as queryGetUserResolver, User as queryGetUsersResolver } from "./MultipleFieldsAsStaticClassMethods";
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
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                getUser: {
                    name: "getUser",
                    type: UserType,
                    resolve(source) {
                        return queryGetUserResolver.getUser(source);
                    }
                },
                getUsers: {
                    name: "getUsers",
                    type: new GraphQLList(new GraphQLNonNull(UserType)),
                    resolve(source) {
                        return queryGetUsersResolver.getUsers(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType, UserType]
    });
}
