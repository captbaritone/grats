## input

```ts title="arguments/CustomScalarArgument.ts"
/** @gqlScalar */
export type MyString = string;

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting: MyString }): string {
    return "Hello world!";
  }
}
```

## Output

### SDL

```graphql
scalar MyString

type SomeType {
  hello(greeting: MyString!): String
}
```

### TypeScript

```ts
import type { GqlScalar } from "grats";
import type { MyString as MyStringInternal } from "./CustomScalarArgument";
import { GraphQLSchema, GraphQLScalarType, GraphQLObjectType, GraphQLString, GraphQLNonNull } from "graphql";
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
                    type: GraphQLString,
                    args: {
                        greeting: {
                            type: new GraphQLNonNull(MyStringType)
                        }
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [MyStringType, SomeTypeType]
    });
}
```