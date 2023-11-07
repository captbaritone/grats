/** @gqlType */
export default class SomeType {
  /** @gqlField */
  b: Promise<string>[];
  /** @gqlField */
  c: Array<Promise<string>>;
}
