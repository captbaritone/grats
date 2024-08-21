/** @gqlType */
abstract class Parent {
  /** @gqlField */
  parentField: string;
}

/** @gqlType */
export class Child extends Parent {
  /** @gqlField */
  childField: string;
}
