/** @gqlInterface */
interface MyInterface {
  /** @gqlField */
  parentField: string;
}

/** @gqlType */
export class Parent implements MyInterface {
  parentField: string;
}

/** @gqlType */
export class Child extends Parent {
  /** @gqlField */
  childField: string;
}

// Note: We use `export` on the above classes to avoid issues with `__typename` being required to be a string literal
// on both which would clash.
