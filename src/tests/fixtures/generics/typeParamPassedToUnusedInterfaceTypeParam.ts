// `Friendly` doesn't use its type parameter in a GraphQL position, so neither
// does `User`, which is therefore not generic.
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
