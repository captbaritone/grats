-----------------
INPUT
----------------- 
/** @gqlInterface Node */
interface GqlNode {
  /** @gqlField */
  id: string;
}

/** @gqlInterface */
interface Person {
  /** @gqlField */
  hello: string;
}

/** @gqlType */
export default class User implements Person, GqlNode {
  readonly __typename = "User" as const;
  /** @gqlField */
  hello: string;

  /** @gqlField */
  id: string;
}

-----------------
OUTPUT
-----------------
-- SDL --
interface Node {
  id: String
}

interface Person {
  hello: String
}

type User implements Node & Person {
  hello: String
  id: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const NodeType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Node",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLString
                }
            };
        }
    });
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
                },
                id: {
                    name: "id",
                    type: GraphQLString
                }
            };
        },
        interfaces() {
            return [NodeType, PersonType];
        }
    });
    return new GraphQLSchema({
        types: [NodeType, PersonType, UserType]
    });
}
