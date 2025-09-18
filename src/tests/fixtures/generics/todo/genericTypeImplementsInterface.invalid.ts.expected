-----------------
INPUT
----------------- 
/** @gqlType */
export class User<T> implements Friendly {
  __typename: "User";
  /** @gqlField */
  name: string;

  /** @gqlField */
  friend: T;
}

/** @gqlInterface */
interface Friendly {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Dog {
  /** @gqlField */
  name: string;
  /** @gqlField */
  bestFriend: User<Dog>;
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/generics/todo/genericTypeImplementsInterface.invalid.ts:2:33 - error: Unexpected `implements` on generic `gqlType`. Generic types may not currently declare themselves as implementing interfaces. Grats requires that all types which implement an interface define a `__typename` field typed as a string literal matching the type's name. Since generic types are synthesized into multiple types with different names, Grats cannot ensure they have a correct `__typename` property and thus declare themselves as interface implementors.

2 export class User<T> implements Friendly {
                                  ~~~~~~~~
