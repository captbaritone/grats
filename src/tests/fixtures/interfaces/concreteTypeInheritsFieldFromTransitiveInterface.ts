/** @gqlInterface */
interface Entity {
  /** @gqlField */
  name: string | null;
}

/** @gqlInterface */
interface IThing extends Entity {
  name: string | null;
}

/** @gqlType */
export class Doohickey implements IThing, Entity {
  __typename: "Doohickey";
  name: string;
}
