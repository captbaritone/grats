/** @gqlType */
export class Query {
  /** @gqlField */
  alwaysThrows(): string {
    throw new Error("This should null out the field");
  }
}

export const query = `
  query {
    alwaysThrows
  }
`;
