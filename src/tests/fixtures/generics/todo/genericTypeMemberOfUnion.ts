/** @gqlType */
export class User<T> {
  __typename: "User";
  /** @gqlField */
  name: string;

  /** @gqlField */
  friend: T;
}

/** @gqUnion */
type Friendly = User<Dog>;

/** @gqlType */
class Dog {
  /** @gqlField */
  name: string;
}
