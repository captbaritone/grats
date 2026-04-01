# enums/EnumFromConstObjectEmpty.invalid.ts

## Input

```ts title="enums/EnumFromConstObjectEmpty.invalid.ts"
const Status = {} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstObjectEmpty.invalid.ts:4:1 - error: Enum type Status must define one or more values.

4 type Status = (typeof Status)[keyof typeof Status];
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```