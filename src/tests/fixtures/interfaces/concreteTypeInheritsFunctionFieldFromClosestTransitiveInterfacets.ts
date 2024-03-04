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

/** @gqlField greeting */
export function iThingGreeting(iThing: IThing): string {
  return `Hello, ${iThing.name ?? "IThing"}!`;
}

/** @gqlType */
export class Doohickey implements IThing, Entity {
  __typename: "Doohickey";
  name: string;
}

// Reverse the order of the interfaces to test that the order doesn't matter
/** @gqlType */
export class Widget implements Entity, IThing {
  __typename: "Widget";
  name: string;
}
