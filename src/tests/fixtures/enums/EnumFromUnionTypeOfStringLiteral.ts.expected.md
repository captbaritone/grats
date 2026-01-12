# enums/EnumFromUnionTypeOfStringLiteral.ts

## Input

```ts title="enums/EnumFromUnionTypeOfStringLiteral.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: MyEnum;
}

/** @gqlEnum */
type MyEnum = "VALID";
```

## Output

### SDL

```graphql
enum MyEnum {
  VALID
}

type SomeType {
  hello: MyEnum
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLEnumType, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const MyEnumType: GraphQLEnumType = new GraphQLEnumType({
        name: "MyEnum",
        values: {
            VALID: {
                value: "VALID"
            }
        }
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: MyEnumType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [MyEnumType, SomeTypeType]
    });
}
```