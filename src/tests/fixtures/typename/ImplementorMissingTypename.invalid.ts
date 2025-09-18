/** @gqlType */
class User implements IPerson {
  /** @gqlField */
  name: string = "Alice";
}

/** @gqlInterface */
export interface IPerson {
  /** @gqlField */
  name: string;
}
