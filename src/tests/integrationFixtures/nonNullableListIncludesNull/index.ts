/** @gqlType */
type Query = unknown;

/** @gqlField */
export function someList(_: Query): string[] {
  // @ts-ignore
  return ["a", null, "b"];
}

/** @gqlField */
export function someListOfLists(_: Query): string[][] {
  // @ts-ignore
  return [["a"], ["b", null, "c"]];
}

export const query = `
  query {
    someList
    someListOfLists
  }
`;
