## input

```ts title="arguments/DeprecatedArgument.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({
    greeting,
  }: {
    /** @deprecated Not used anymore */
    greeting?: string | null;
  }): string {
    return "Hello world!";
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  hello(greeting: String @deprecated(reason: "Not used anymore")): String
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
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    args: {
                        greeting: {
                            deprecationReason: "Not used anymore",
                            type: GraphQLString
                        }
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