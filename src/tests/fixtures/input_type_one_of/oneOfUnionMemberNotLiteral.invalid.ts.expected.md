# input_type_one_of/oneOfUnionMemberNotLiteral.invalid.ts

## Input

```ts title="input_type_one_of/oneOfUnionMemberNotLiteral.invalid.ts"
/**
 * @gqlInput
 */
export type Greeting = string | { name: string };
```

## Output

### Error Report

```text
src/tests/fixtures/input_type_one_of/oneOfUnionMemberNotLiteral.invalid.ts:4:24 - error: Expected each member of a @oneOf @gqlInput to be a TypeScript object literal with exactly one property.

4 export type Greeting = string | { name: string };
                         ~~~~~~
```