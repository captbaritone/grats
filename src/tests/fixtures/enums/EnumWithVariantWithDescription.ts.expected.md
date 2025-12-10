## input

```ts title="enums/EnumWithVariantWithDescription.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlEnum */
enum Enum {
  /** Valid enum value. */
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
  VALID
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