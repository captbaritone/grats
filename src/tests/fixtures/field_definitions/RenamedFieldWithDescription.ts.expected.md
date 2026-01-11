# field_definitions/RenamedFieldWithDescription.ts

## Input

```ts title="field_definitions/RenamedFieldWithDescription.ts"
/** @gqlType */
class SomeType {
  /**
   * Number 1 greeting.
   *
   * @gqlField greeting
   */
  somePropertyField: string;

  /**
   * Number 1 salutation.
   *
   * @gqlField salutaion
   */
  someMethodField(): string {
    return "Hello world!";
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  """Number 1 greeting."""
  greeting: String
  """Number 1 salutation."""
  salutaion: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                greeting: {
                    description: "Number 1 greeting.",
                    name: "greeting",
                    type: GraphQLString,
                    resolve(source) {
                        return source.somePropertyField;
                    }
                },
                salutaion: {
                    description: "Number 1 salutation.",
                    name: "salutaion",
                    type: GraphQLString,
                    resolve(source) {
                        return source.someMethodField();
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```