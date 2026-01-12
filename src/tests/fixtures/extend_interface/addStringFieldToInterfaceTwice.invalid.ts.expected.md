# extend_interface/addStringFieldToInterfaceTwice.invalid.ts

## Input

```ts title="extend_interface/addStringFieldToInterfaceTwice.invalid.ts"
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

/** @gqlField greeting */
export function alsoGreeting(person: IPerson): string {
  return `Hello ${person.name}!`;
}

/** @gqlType */
class User implements IPerson {
  __typename: "User";
  name: string;
  /** @gqlField */
  hello: string;
}

/** @gqlType */
class Admin implements IPerson {
  __typename: "Admin";
  name: string;
  /** @gqlField */
  hello: string;
}
```

## Output

### Error Report

```text
src/tests/fixtures/extend_interface/addStringFieldToInterfaceTwice.invalid.ts:9:17 - error: Field "IPerson.greeting" can only be defined once.

9 export function greeting(person: IPerson): string {
                  ~~~~~~~~

  src/tests/fixtures/extend_interface/addStringFieldToInterfaceTwice.invalid.ts:13:5
    13 /** @gqlField greeting */
           ~~~~~~~~~~~~~~~~~~~
    Related location
src/tests/fixtures/extend_interface/addStringFieldToInterfaceTwice.invalid.ts:9:17 - error: Field "Admin.greeting" can only be defined once.

9 export function greeting(person: IPerson): string {
                  ~~~~~~~~

  src/tests/fixtures/extend_interface/addStringFieldToInterfaceTwice.invalid.ts:13:5
    13 /** @gqlField greeting */
           ~~~~~~~~~~~~~~~~~~~
    Related location
src/tests/fixtures/extend_interface/addStringFieldToInterfaceTwice.invalid.ts:9:17 - error: Field "User.greeting" can only be defined once.

9 export function greeting(person: IPerson): string {
                  ~~~~~~~~

  src/tests/fixtures/extend_interface/addStringFieldToInterfaceTwice.invalid.ts:13:5
    13 /** @gqlField greeting */
           ~~~~~~~~~~~~~~~~~~~
    Related location
```