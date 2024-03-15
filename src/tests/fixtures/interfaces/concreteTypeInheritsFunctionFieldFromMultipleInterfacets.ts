/** @gqlInterface */
interface Entity {
  /** @gqlField */
  name: string | null;
}

/** @gqlInterface */
interface NotEntity {}

/** @gqlField */
export function name(_: NotEntity): string | null {
  return "Hello";
}

/** @gqlType */
export class Doohickey implements Entity, NotEntity {
  __typename: "Doohickey";
  name: string;
}
