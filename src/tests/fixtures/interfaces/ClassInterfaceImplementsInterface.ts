/** @gqlInterface Node */
interface GqlNode {
  /** @gqlField */
  id: string;
}

/** @gqlInterface */
interface Person extends GqlNode {
  id: string;
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
class Actor implements GqlNode, Person {
  id: string;
  name: string;
}
