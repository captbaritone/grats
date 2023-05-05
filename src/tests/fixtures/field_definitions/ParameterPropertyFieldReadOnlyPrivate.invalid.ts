/** @gqlType */
export default class Query {
  constructor(
    /**
     * Greet the world!
     * @gqlField
     */
    private readonly hello: string,
  ) {}
}
