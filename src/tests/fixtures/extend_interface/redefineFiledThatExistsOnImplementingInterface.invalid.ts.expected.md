# extend_interface/redefineFiledThatExistsOnImplementingInterface.invalid.ts

## Input

```ts title="extend_interface/redefineFiledThatExistsOnImplementingInterface.invalid.ts"
/** @gqlInterface */
interface IPerson {
  name: string;
  /** @gqlField */
  hello: string;
}

/** @gqlField */
export function greeting(person: IPerson): string {
  return `Hello ${person.name}!`;
}

/** @gqlInterface */
interface User extends IPerson {
  __typename: "User";
  name: string;
  /** @gqlField */
  hello: string;

  /** @gqlField */
  greeting(): string;
}
```

## Output

### Error Report

```text
src/tests/fixtures/extend_interface/redefineFiledThatExistsOnImplementingInterface.invalid.ts:21:3 - error: Field "User.greeting" can only be defined once.

21   greeting(): string;
     ~~~~~~~~

  src/tests/fixtures/extend_interface/redefineFiledThatExistsOnImplementingInterface.invalid.ts:9:17
    9 export function greeting(person: IPerson): string {
                      ~~~~~~~~
    Related location
```