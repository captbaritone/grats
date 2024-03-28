/** @gqlType */
export class User<T> implements Friendly<T> {
  __typename: "User";
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
interface Friendly<T> {
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
