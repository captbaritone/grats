/** @gqlType */
export default class SomeType {
  constructor(
    /** @gqlField */
    private helloPrivate: string,
    /** @gqlField */
    protected helloProtected: string,
  ) {}
}
