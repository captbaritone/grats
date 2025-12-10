-----------------
INPUT
----------------- 
declare const Foo: {
  prototype: Foo;
  new (): Foo;
};

/** @gqlInterface */
interface Foo {
  /** @gqlField */
  id: string;
}

-----------------
OUTPUT
-----------------
-- SDL --
interface Foo {
  id: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const FooType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Foo",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [FooType]
    });
}
