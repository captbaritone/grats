# extend_interface/redefineFiledThatExistsOnConcreteType.invalid.ts

## Input

```ts title="extend_interface/redefineFiledThatExistsOnConcreteType.invalid.ts"
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

/** @gqlType */
class User implements IPerson {
  __typename: "User";
  name: string;
  /** @gqlField */
  hello: string;

  /** @gqlField */
  greeting(): string {
    return `Hello ${this.name}!`;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/extend_interface/redefineFiledThatExistsOnConcreteType.invalid.ts:21:3 - error: Field "User.greeting" can only be defined once.

21   greeting(): string {
     ~~~~~~~~

  src/tests/fixtures/extend_interface/redefineFiledThatExistsOnConcreteType.invalid.ts:9:17
    9 export function greeting(person: IPerson): string {
                      ~~~~~~~~
    Related location
```