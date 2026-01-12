# configOptions/importModuleSpecifierEnding.ts

## Input

```ts title="configOptions/importModuleSpecifierEnding.ts"
// {"importModuleSpecifierEnding": ".js"}

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlField */
export function greeting(t: SomeType): string {
  return t.hello + " world!";
}
```

## Output

### SDL

```graphql
type SomeType {
  greeting: String
  hello: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as someTypeGreetingResolver } from "./importModuleSpecifierEnding.js";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve(source) {
                        return someTypeGreetingResolver(source);
                    }
                },
                hello: {
                    name: "hello",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```