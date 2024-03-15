/** @gqlInterface */
interface Entity {
  name: string | null;
}

/** @gqlField */
export function greeting(entity: Entity): string {
  return `Hello, ${entity.name ?? "World"}!`;
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
