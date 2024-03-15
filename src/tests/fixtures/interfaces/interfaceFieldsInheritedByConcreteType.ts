/** @gqlInterface */
interface IThing {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Doohickey implements IThing {
  __typename: "Doohickey";
  name: string;
}
