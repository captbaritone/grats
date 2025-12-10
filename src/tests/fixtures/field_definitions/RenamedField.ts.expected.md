## input

```ts title="field_definitions/RenamedField.ts"
/** @gqlType */
class SomeType {
  /** @gqlField greeting */
  somePropertyField: string;

  /** @gqlField salutaion */
  someMethodField(): string {
    return "Hello world!";
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  greeting: String
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
                    name: "greeting",
                    type: GraphQLString,
                    resolve(source) {
                        return source.somePropertyField;
                    }
                },
                salutaion: {
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