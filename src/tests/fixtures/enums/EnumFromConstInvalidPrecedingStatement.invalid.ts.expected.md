# enums/EnumFromConstInvalidPrecedingStatement.invalid.ts

## Input

```ts title="enums/EnumFromConstInvalidPrecedingStatement.invalid.ts"
/** @gqlEnum */
type First = (typeof MUTABLE)[number];

let MUTABLE = ["A", "B"] as const;

/** @gqlEnum */
type Mutable = (typeof MUTABLE)[number];

const FIRST = ["A", "B"] as const,
  SECOND = ["C"] as const;

/** @gqlEnum */
type Multiple = (typeof FIRST)[number];

const [DESTRUCTURED] = [["A", "B"] as const];

/** @gqlEnum */
type Destructured = (typeof DESTRUCTURED)[number];

const OTHER_NAME = ["A", "B"] as const;

/** @gqlEnum */
type Mismatch = (typeof NAME)[number];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstInvalidPrecedingStatement.invalid.ts:2:14 - error: When deriving a `@gqlEnum` from a const value using `typeof`, the const declaration must be the immediately preceding statement. Grats requires this co-location to ensure it's clear which declarations contribute to the GraphQL schema. For example:

const VALUES = ["FOO", "BAR"] as const;

/** @gqlEnum */
type MyEnum = (typeof VALUES)[number];

2 type First = (typeof MUTABLE)[number];
               ~~~~~~~~~~~~~~~~~~~~~~~~
src/tests/fixtures/enums/EnumFromConstInvalidPrecedingStatement.invalid.ts:7:16 - error: When deriving a `@gqlEnum` from a const value using `typeof`, the const declaration must be the immediately preceding statement. Grats requires this co-location to ensure it's clear which declarations contribute to the GraphQL schema. For example:

const VALUES = ["FOO", "BAR"] as const;

/** @gqlEnum */
type MyEnum = (typeof VALUES)[number];

7 type Mutable = (typeof MUTABLE)[number];
                 ~~~~~~~~~~~~~~~~~~~~~~~~
src/tests/fixtures/enums/EnumFromConstInvalidPrecedingStatement.invalid.ts:13:17 - error: When deriving a `@gqlEnum` from a const value using `typeof`, the const declaration must be the immediately preceding statement. Grats requires this co-location to ensure it's clear which declarations contribute to the GraphQL schema. For example:

const VALUES = ["FOO", "BAR"] as const;

/** @gqlEnum */
type MyEnum = (typeof VALUES)[number];

13 type Multiple = (typeof FIRST)[number];
                   ~~~~~~~~~~~~~~~~~~~~~~
src/tests/fixtures/enums/EnumFromConstInvalidPrecedingStatement.invalid.ts:18:21 - error: When deriving a `@gqlEnum` from a const value using `typeof`, the const declaration must be the immediately preceding statement. Grats requires this co-location to ensure it's clear which declarations contribute to the GraphQL schema. For example:

const VALUES = ["FOO", "BAR"] as const;

/** @gqlEnum */
type MyEnum = (typeof VALUES)[number];

18 type Destructured = (typeof DESTRUCTURED)[number];
                       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
src/tests/fixtures/enums/EnumFromConstInvalidPrecedingStatement.invalid.ts:23:17 - error: Expected the `const` declaration immediately before this `@gqlEnum` to be named `NAME` (to match `typeof NAME`), but found `OTHER_NAME`. The `const` referenced in the type must be the immediately preceding statement. Grats requires this co-location to ensure it's clear which declarations contribute to the GraphQL schema.

23 type Mismatch = (typeof NAME)[number];
                   ~~~~~~~~~~~~~~~~~~~~~
```