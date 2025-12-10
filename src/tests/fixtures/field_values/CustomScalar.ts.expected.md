## input

```ts title="field_values/CustomScalar.ts"
/** @gqlScalar */
export type MyString = string;

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): MyString {
    return "Hello world!";
  }
}
```

## Output

```
-- SDL --
scalar MyString

type SomeType {
  hello: MyString
}
-- TypeScript --
import type { GqlScalar } from "grats";
import type { MyString as MyStringInternal } from "./CustomScalar";
import { GraphQLSchema, GraphQLScalarType, GraphQLObjectType } from "graphql";
export type SchemaConfig = {
    scalars: {
        MyString: GqlScalar<MyStringInternal>;
    };
};
export function getSchema(config: SchemaConfig): GraphQLSchema {
    const MyStringType: GraphQLScalarType = new GraphQLScalarType({
        name: "MyString",
        ...config.scalars.MyString
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: MyStringType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [MyStringType, SomeTypeType]
    });
}
```