## input

```ts title="todo/RedefineBuiltinScalar.ts"
/** @gqlScalar String */
export type MyUrl = string;
```

## Output

```
-- SDL --

-- TypeScript --
import { GraphQLSchema } from "graphql";
export function getSchema(): GraphQLSchema {
    return new GraphQLSchema({
        types: []
    });
}
```