/** @gqlInterface Node */
interface GqlNode {
  /** @gqlField */
  id: string;
}

/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/**
 * @gqlInterface
 * @gqlImplements Node, Person
 */
interface Actor {
  /** @gqlField */
  id: string;
  /** @gqlField */
  name: string;
}
