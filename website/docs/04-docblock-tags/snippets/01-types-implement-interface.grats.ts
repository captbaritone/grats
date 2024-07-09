/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlType */
// highlight-start
export class User implements Person {
  // highlight-end
  /** @gqlField */
  name: string;
}
