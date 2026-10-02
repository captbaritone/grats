# user_error/DuplicateInfoTag.invalid.ts

## Input

```ts title="user_error/DuplicateInfoTag.invalid.ts"
// Every `@gqlInfo` after the first is reported, including the one on Grats'
// own `GqlInfo`, which is read after this file.

/** @gqlInfo */
type Info = { foo: string };

/** @gqlInfo */
type OtherInfo = { bar: string };

/** @gqlInfo */
type YetAnotherInfo = { baz: string };

/** @gqlQueryField */
export function hello(): string {
  return "Hello";
}
```

## Output

### Error Report

```text
src/tests/fixtures/user_error/DuplicateInfoTag.invalid.ts:7:5 - error: Unexpected user-defined `@gqlInfo` tag. Use the type `GqlInfo` exported from `grats`: `import type { GqlInfo } from "grats";`.

7 /** @gqlInfo */
      ~~~~~~~~~
src/tests/fixtures/user_error/DuplicateInfoTag.invalid.ts:10:5 - error: Unexpected user-defined `@gqlInfo` tag. Use the type `GqlInfo` exported from `grats`: `import type { GqlInfo } from "grats";`.

10 /** @gqlInfo */
       ~~~~~~~~~
src/Types.ts:15:5 - error: Unexpected user-defined `@gqlInfo` tag. Use the type `GqlInfo` exported from `grats`: `import type { GqlInfo } from "grats";`.

15 /** @gqlInfo */
       ~~~~~~~~~
```