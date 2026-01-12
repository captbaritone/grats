# enums/Enum.ts

## Input

```ts title="enums/Enum.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlEnum */
enum Enum {
  VALID = "VALID",
  INVALID = "INVALID",
}
```

## Output

### SDL

```graphql
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