// highlight-start
/**
 * A description of my union.
 * @gqlUnion
 */
type MyUnion = User | Post;
// highlight-end

/** @gqlType */
class User {
  __typename: "User";
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Post {
  __typename: "Post";
  /** @gqlField */
  content: string;

  /** @gqlField */
  author: User;
}
