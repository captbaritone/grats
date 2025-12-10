-----------------
INPUT
----------------- 
import { Int } from "../../../Types";

/** @gqlInterface */
interface Mammal {
  /** @gqlField */
  legs: Int;
}

/** @gqlInterface */
export interface Person extends Mammal {
  /** @gqlField */
  name: string;

  /** @gqlField */
  legs: Int;
}

/** @gqlInterface */
export interface User extends Mammal, Person {
  __typename: "User";

  /** @gqlField */
  name: string;

  /** @gqlField */
  legs: Int;
}

-----------------
OUTPUT
-----------------
-- SDL --
interface Mammal {
  legs: Int
}

interface Person implements Mammal {
  legs: Int
  name: String
}

interface User implements Mammal & Person {
  legs: Int
  name: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLInterfaceType, GraphQLInt, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const MammalType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Mammal",
        fields() {
            return {
                legs: {
                    name: "legs",
                    type: GraphQLInt
                }
            };
        }
    });
    const PersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Person",
        fields() {
            return {
                legs: {
                    name: "legs",
                    type: GraphQLInt
                },
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        },
        interfaces() {
            return [MammalType];
        }
    });
    const UserType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "User",
        fields() {
            return {
                legs: {
                    name: "legs",
                    type: GraphQLInt
                },
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        },
        interfaces() {
            return [MammalType, PersonType];
        }
    });
    return new GraphQLSchema({
        types: [MammalType, PersonType, UserType]
    });
}
