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
