## input

```ts title="locate/interface.invalid.ts"
// Locate: Person
/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}
```

## Output

```
src/tests/fixtures/locate/interface.invalid.ts:3:11 - error: Located here

3 interface Person {
            ~~~~~~
```