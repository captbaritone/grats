-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me: Actor;
}

/** @gqlType */
class User {
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
interface Entity {
  /** @gqlField */
  description: string;
}

/** @gqlUnion */
type Actor = User | Entity;

-----------------
OUTPUT
-----------------
src/tests/fixtures/unions/DefineUnionTypeContainingInterface.invalid.ts:20:21 - error: Union type Actor can only include Object types, it cannot include Entity.

20 type Actor = User | Entity;
                       ~~~~~~
