/** @gqlType */
export default class Query {
  constructor(
    /** @gqlField */
    hello: string,
  ) {
    console.log(hello);
  }
}
