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
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Entity {
  __typename = "Entity" as const;
  /** @gqlField */
  description: string;
}

/** @gqlType */
class Admin {
  __typename = "Admin" as const;
  /** @gqlField */
  description: string;
}

/** @gqlUnion */
type Foo = User | Entity;

/** @gqlUnion */
type Actor = Admin | Foo;

-----------------
OUTPUT
-----------------
src/tests/fixtures/unions/UnionAsMemberOfOtherUnion.invalid.ts:32:22 - error: Union type Actor can only include Object types, it cannot include Foo.

32 type Actor = Admin | Foo;
                        ~~~
