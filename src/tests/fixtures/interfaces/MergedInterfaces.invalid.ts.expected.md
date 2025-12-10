## input

```ts title="interfaces/MergedInterfaces.invalid.ts"
import { ID } from "../../../types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me(): Node {
    throw new Error("Not implemented");
  }
}

interface Node {
  id: ID;
}

/** @gqlInterface */
interface Node {
  /** @gqlField */
  id: string;
}
```

## Output

### Error Report

```text
src/tests/fixtures/interfaces/MergedInterfaces.invalid.ts:16:11 - error: Unexpected merged interface. If an interface is declared multiple times in a scope, TypeScript merges them. To avoid ambiguity Grats does not support using merged interfaces as GraphQL definitions. Consider using a unique name for your TypeScript interface and renaming it.

 Learn more: https://grats.capt.dev/docs/docblock-tags/interfaces/#merged-interfaces

16 interface Node {
             ~~~~

  src/tests/fixtures/interfaces/MergedInterfaces.invalid.ts:11:11
    11 interface Node {
                 ~~~~
    Other declaration
```