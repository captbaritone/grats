## input

```ts title="typename/ImplementorMissingTypename.invalid.ts"
/** @gqlType */
class User implements IPerson {
  /** @gqlField */
  name: string = "Alice";
}

/** @gqlInterface */
export interface IPerson {
  /** @gqlField */
  name: string;
}
```

## Output

### Error Report

```text
src/tests/fixtures/typename/ImplementorMissingTypename.invalid.ts:2:7 - error: Cannot resolve typename. The type `User` implements `IPerson`, so it must either have a `__typename` property or be an exported class.

2 class User implements IPerson {
        ~~~~

  src/tests/fixtures/typename/ImplementorMissingTypename.invalid.ts:8:18
    8 export interface IPerson {
                       ~~~~~~~
    IPerson is defined here:
```