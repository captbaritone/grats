## input

```ts title="enums/EnumWithDescription.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: string;
}

/**
 * World's best enum.
 *
 * @gqlEnum
 */
enum Enum {
  VALID = "VALID",
  INVALID = "INVALID",
}
```

## Output

### SDL

```graphql
"""World's best enum."""
enum Enum {
  INVALID
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
        description: "World's best enum.",
        name: "Enum",
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