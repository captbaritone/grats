/** @gqlType */
export default interface Query extends HasName {
  /** @gqlField */
  hello: string;

  /** @gqlField */
  name: string;
}

/** @gqlInterface */
interface HasName {
  /** @gqlField */
  name: string;
}
