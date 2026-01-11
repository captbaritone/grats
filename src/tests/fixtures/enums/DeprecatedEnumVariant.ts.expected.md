# enums/DeprecatedEnumVariant.ts

## Input

```ts title="enums/DeprecatedEnumVariant.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlEnum */
enum Enum {
  /**
   * Valid enum value.
   * @deprecated Use something else.
   */
  VALID = "VALID",
  /** Invalid enum value. */
  INVALID = "INVALID",
}
```

## Output

### SDL

```graphql
enum Enum {
  """Invalid enum value."""
  INVALID
  """Valid enum value."""
  VALID @deprecated(reason: "Use something else.")
}

type SomeType {
  hello: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLEnumType, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const EnumType: GraphQLEnumType = new GraphQLEnumType({
        name: "Enum",
        values: {
            INVALID: {
                description: "Invalid enum value.",
                value: "INVALID"
            },
            VALID: {
                description: "Valid enum value.",
                deprecationReason: "Use something else.",
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
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [EnumType, SomeTypeType]
    });
}
```