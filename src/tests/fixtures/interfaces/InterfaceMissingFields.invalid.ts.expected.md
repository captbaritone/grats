## input

```ts title="interfaces/InterfaceMissingFields.invalid.ts"
/** @gqlInterface */
interface SomeType {}
```

## Output

### Error Report

```text
src/tests/fixtures/interfaces/InterfaceMissingFields.invalid.ts:2:11 - error: Interface `SomeType` must define one or more fields.

Define a field by adding `/** @gqlField */` above a field, property, attribute or method of this type, or above a function that has `SomeType` as its first argument.

2 interface SomeType {}
            ~~~~~~~~
```