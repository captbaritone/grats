/** @gqlType */
export class Query {
  constructor(
    /** @gqlField hello */
    public NOT_THIS: string = "world",
  ) {}
}

export const query = `
  query {
    hello
  }
`;
