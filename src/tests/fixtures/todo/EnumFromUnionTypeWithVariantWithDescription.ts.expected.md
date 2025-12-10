## input

```ts title="todo/EnumFromUnionTypeWithVariantWithDescription.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: MyEnum;
}

/** @gqlEnum */
type MyEnum =
  /** VALIDATED! */
  | "VALID"
  /** INVALIDATED! */
  | "INVALID";
```

## Output

### SDL

```graphql
enum MyEnum {
  INVALID
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
            INVALID: {
                value: "INVALID"
            },
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