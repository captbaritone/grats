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

/** @gqlInterface */
interface Actor
  // Grats ignores these
  extends GqlNode,
    Person {
  /** @gqlField */
  id: string;
  /** @gqlField */
  name: string;
}
