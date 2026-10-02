class Base {
  hello: string = "Hello";
}

/** @gqlType */
export default class SomeType extends Base {
  constructor(
    /** @gqlField */
    override hello: string,
  ) {
    super();
  }
}
