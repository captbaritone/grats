/** @gqlType */
export class SomeType {
  /** @gqlField */
  hello: string;
}

/**
 * Check out this great input!
 * @gqlInput
 * @deprecated This old thing?
 */
type MyInputType = {
  someField: string;
};
