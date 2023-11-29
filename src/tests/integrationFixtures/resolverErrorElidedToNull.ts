/** @gqlType */
type Query = unknown;

/** @gqlField */
export function alwaysThrows(_: Query): string {
  throw new Error("This should null out the field");
}

export const query = `
  query {
    alwaysThrows
  }
`;
