/** @gqlQueryField */
export function someList(): string[] {
  // @ts-ignore
  return ["a", null, "b"];
}

/** @gqlQueryField */
export function someListOfLists(): string[][] {
  // @ts-ignore
  return [["a"], ["b", null, "c"]];
}

export const query = `
  query {
    someList
    someListOfLists
  }
`;
