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
