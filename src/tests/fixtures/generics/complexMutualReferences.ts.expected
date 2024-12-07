-----------------
INPUT
----------------- 
/** @gqlType */
type Foo<T> = {
  /** @gqlField */
  someField: Bar<T>;
  /** @gqlField */
  baz: Baz;
};

/** @gqlType */
type Bar<T> = {
  /** @gqlField */
  anotherField: Foo<T>;
};

/** @gqlType */
type Baz = {
  /** @gqlField */
  bazField: Bar<Baz>;
};

-----------------
OUTPUT
-----------------
-- SDL --
type Baz {
  bazField: BazBar
}

type BazBar {
  anotherField: BazFoo
}

type BazFoo {
  baz: Baz
  someField: BazBar
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const BazFooType: GraphQLObjectType = new GraphQLObjectType({
        name: "BazFoo",
        fields() {
            return {
                baz: {
                    name: "baz",
                    type: BazType
                },
                someField: {
                    name: "someField",
                    type: BazBarType
                }
            };
        }
    });
    const BazBarType: GraphQLObjectType = new GraphQLObjectType({
        name: "BazBar",
        fields() {
            return {
                anotherField: {
                    name: "anotherField",
                    type: BazFooType
                }
            };
        }
    });
    const BazType: GraphQLObjectType = new GraphQLObjectType({
        name: "Baz",
        fields() {
            return {
                bazField: {
                    name: "bazField",
                    type: BazBarType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [BazType, BazBarType, BazFooType]
    });
}
