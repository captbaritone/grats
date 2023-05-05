/** @gqlType */
export default class Query {
  constructor(
    /** @gqlField */
    private helloPrivate: string,
    /** @gqlField */
    protected helloProtected: string,
  ) {}
}
