# field_values/KillsParentOnExceptionDoesNotMatchInterface.invalid.ts

## Input

```ts title="field_values/KillsParentOnExceptionDoesNotMatchInterface.invalid.ts"
/** @gqlInterface */
interface IPerson {
  /**
   * @killsParentOnException
   * @gqlField
   */
  name(): string;
}

/** @gqlType */
export class User implements IPerson {
  __typename = "User" as const;
  /** @gqlField */
  // @ts-ignore
  name(): string | null {
    if (Math.random() < 0.5) {
      return null;
    }
    return "Alice";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_values/KillsParentOnExceptionDoesNotMatchInterface.invalid.ts:4:7 - error: Interface field IPerson.name expects type String! but User.name is type String.

4    * @killsParentOnException
        ~~~~~~~~~~~~~~~~~~~~~~

  src/tests/fixtures/field_values/KillsParentOnExceptionDoesNotMatchInterface.invalid.ts:15:11
    15   name(): string | null {
                 ~~~~~~~~~~~~~
    Related location
```