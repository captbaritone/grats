-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me: Actor;
}

/** @gqlType */
class User {
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Entity {
  __typename = "Entity" as const;
  /** @gqlField */
  description: string;
}

/**
 * One type to rule them all, and in a union bind them.
 * @gqlUnion
 */
type Actor = User | Entity;

-----------------
OUTPUT
-----------------
-- SDL --
"""One type to rule them all, and in a union bind them."""
union Actor = Entity | User

type Entity {
  description: String
}

type SomeType {
  me: Actor
}

type User {
  name: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLUnionType, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const EntityType: GraphQLObjectType = new GraphQLObjectType({
        name: "Entity",
        fields() {
            return {
                description: {
                    name: "description",
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
        }
    });
    const ActorType: GraphQLUnionType = new GraphQLUnionType({
        name: "Actor",
        description: "One type to rule them all, and in a union bind them.",
        types() {
            return [EntityType, UserType];
        }
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                me: {
                    name: "me",
                    type: ActorType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [ActorType, EntityType, SomeTypeType, UserType]
    });
}
