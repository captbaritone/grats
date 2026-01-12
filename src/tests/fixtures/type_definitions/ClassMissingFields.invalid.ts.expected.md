# type_definitions/ClassMissingFields.invalid.ts

## Input

```ts title="type_definitions/ClassMissingFields.invalid.ts"
/** @gqlType */
export default class SomeType {}
```

## Output

### Error Report

```text
src/tests/fixtures/type_definitions/ClassMissingFields.invalid.ts:2:22 - error: Type `SomeType` must define one or more fields.

Define a field by adding `/** @gqlField */` above a field, property, attribute or method of this type, or above a function that has `SomeType` as its first argument.

2 export default class SomeType {}
                       ~~~~~~~~
```