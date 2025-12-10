-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting: string = "Hello"): string {
    return `${greeting} World`;
  }
}

-----------------
OUTPUT
-----------------
-- SDL --
type SomeType {
  hello(greeting: String! = "Hello"): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    args: {
                        greeting: {
                            type: new GraphQLNonNull(GraphQLString),
                            defaultValue: "Hello"
                        }
                    },
                    resolve(source, args) {
                        return source.hello(args.greeting);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
