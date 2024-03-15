// { "nullableByDefault": false }
/** @gqlInterface */
interface IThing {
  /** @gqlField */
  name: string | null;
}

/** @gqlType */
export class Doohickey implements IThing {
  __typename: "Doohickey";
  /** @gqlField */
  name: string;
}
