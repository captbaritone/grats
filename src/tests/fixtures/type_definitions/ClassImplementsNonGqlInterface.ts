/**
 * The root of all evil.
 * @gqlType
 */
export default class User implements IPerson {
  /** @gqlField */
  hello: string;
}

interface IPerson {
  hello: string;
}
