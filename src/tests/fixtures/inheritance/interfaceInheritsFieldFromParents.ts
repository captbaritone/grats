/** @gqlInterface */
interface A {
  /** @gqlField */
  aField: string;
}

/** @gqlInterface */
interface B {
  /** @gqlField */
  bField: string;
}

/** @gqlInterface */
interface C extends A, B {
  aField: string;
  bField: string;
}
