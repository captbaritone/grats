/** @gqlType */
class User implements Friendly<Dog> {
  __typename: "User";
  /** @gqlField */
  name: string;
  /** @gqlField */
  to: Dog;
}

/** @gqlInterface */
interface Friendly<T> {
  /** @gqlField */
  to: T;
}

/** @gqlType */
class Dog {
  /** @gqlField */
  name: string;
  /** @gqlField */
  bestFriend: Friendly<Dog>;
}
