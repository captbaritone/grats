# enums/EnumFromUnionTypeWithDeprecatedAndAnnotatedVariants.ts

## Input

```ts title="enums/EnumFromUnionTypeWithDeprecatedAndAnnotatedVariants.ts"
import { Int } from "../../../Types";

/** @gqlDirective on ENUM_VALUE */
export function cost(args: { credits: Int }) {}

/** @gqlEnum */
type MyEnum =
  /**
   * The old name.
   * @deprecated Use VALID instead.
   */
  | "OK"
  /** @gqlAnnotate cost(credits: 1) */
  | "VALID"
  | "INVALID";

/** @gqlType */
export class SomeType {
  /** @gqlField */
  hello: MyEnum;
}
```

## Output

### SDL

```graphql
directive @cost(credits: Int!) on ENUM_VALUE

enum MyEnum {
  INVALID
  """The old name."""
  OK @deprecated(reason: "Use VALID instead.")
  VALID @cost(credits: 1)
}

type SomeType {
  hello: MyEnum
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLInt, specifiedDirectives, GraphQLEnumType, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const MyEnumType: GraphQLEnumType = new GraphQLEnumType({
        name: "MyEnum",
        values: {
            INVALID: { value: "INVALID" },
            OK: {
                description: "The old name.",
                deprecationReason: "Use VALID instead.",
                value: "OK"
            },
            VALID: {
                value: "VALID",
                extensions: { grats: { directives: [{
                    name: "cost",
                    args: { credits: 1 }
                }] } }
            }
        }
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return { hello: {
                name: "hello",
                type: MyEnumType
            } };
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
            name: "cost",
            locations: [DirectiveLocation.ENUM_VALUE],
            args: { credits: { type: new GraphQLNonNull(GraphQLInt) } }
        })],
        types: [MyEnumType, SomeTypeType]
    });
}
```