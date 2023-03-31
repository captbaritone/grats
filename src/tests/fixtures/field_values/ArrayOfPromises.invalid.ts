/** @gqlType */
export default class Query {
  /** @gqlField */
  b: Promise<string>[];
  /** @gqlField */
  c: Array<Promise<string>>;
}
