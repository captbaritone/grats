/** @gqlInterface */
interface IThing {
  /**
   * This description is on the interface type.
   * @gqlField
   */
  name: string;
}

/** @gqlType */
export class Doohickey implements IThing {
  __typename: "Doohickey";
  /**
   * This description is on the concrete type.
   * @gqlField
   */
  name: string;
}
